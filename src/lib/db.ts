import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  if (dbUrl.startsWith('libsql://')) {
    // CRITICAL FIX: @libsql/client's createClient() ignores the `url` parameter
    // in Vercel standalone builds and reads from process.env.TURSO_DATABASE_URL instead.
    // We must set it so the internal fallback works.
    if (!process.env.TURSO_DATABASE_URL) {
      process.env.TURSO_DATABASE_URL = dbUrl
    }
    if (!process.env.TURSO_AUTH_TOKEN && process.env.DATABASE_AUTH_TOKEN) {
      process.env.TURSO_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN
    }

    let PrismaLibSQL: any
    let createClient: any

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapterMod = require('@prisma/adapter-libsql')
      PrismaLibSQL = adapterMod.PrismaLibSQL || adapterMod.default || adapterMod
    } catch (e) {
      throw new Error(
        `load_adapter_failed: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const libsqlMod = require('@libsql/client')
      createClient = libsqlMod.createClient || libsqlMod.default?.createClient
    } catch (e) {
      throw new Error(
        `load_libsql_failed: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })

    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  return new PrismaClient({ log: ['error'] })
}

// Lazy initialization via Proxy — never crashes at module load time
let _db: PrismaClient | undefined
let _dbInitFailed = false

function getDb(): PrismaClient {
  if (_db) return _db
  if (globalForPrisma.prisma) {
    _db = globalForPrisma.prisma
    return _db
  }
  try {
    _db = createDb()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _db
    }
    return _db
  } catch (e) {
    _dbInitFailed = true
    throw e
  }
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (_dbInitFailed) {
      throw new Error('Database init failed. Check /api/debug')
    }
    const actualDb = getDb()
    const value = (actualDb as any)[prop]
    if (typeof value === 'function') {
      return value.bind(actualDb)
    }
    return value
  },
})
