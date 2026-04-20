import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  if (dbUrl.startsWith('libsql://')) {
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

// Lazy initialization — don't create DB connection at module load time.
// This prevents the entire module from crashing if require() fails.
let _db: PrismaClient | undefined
let _dbInitFailed = false

export function getDb(): PrismaClient {
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

// Backwards-compatible export — works like a real PrismaClient but initializes lazily
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (_dbInitFailed) {
      throw new Error(
        `Database module failed to initialize. Check /api/debug for details.`
      )
    }
    const actualDb = getDb()
    const value = (actualDb as any)[prop]
    if (typeof value === 'function') {
      return value.bind(actualDb)
    }
    return value
  },
})

export function isDbInitialized(): boolean {
  return _db !== undefined || globalForPrisma.prisma !== undefined
}

export function getDbInitError(): boolean {
  return _dbInitFailed
}
