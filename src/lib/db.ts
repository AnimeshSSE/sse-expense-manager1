import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  // Capture the real Turso URL before we overwrite process.env
  const realDbUrl = process.env.DATABASE_URL || ''
  const authToken = process.env.DATABASE_AUTH_TOKEN || ''

  if (realDbUrl.startsWith('libsql://')) {
    // ────────────────────────────────────────────────────────────────────────
    // CRITICAL: When using Prisma Driver Adapters, Prisma STILL validates
    // the schema's datasource URL (`url = env("DATABASE_URL")`) at client
    // construction time. On Vercel standalone builds this resolution can
    // fail, returning the string 'undefined'.
    //
    // Solution: Set DATABASE_URL to a valid dummy SQLite file URL so Prisma's
    // schema validation passes. The actual Turso connection is handled
    // entirely by the adapter (libsql client), NOT by Prisma's datasource.
    // ────────────────────────────────────────────────────────────────────────
    process.env.DATABASE_URL = 'file:./dev.db'

    // Set fallback env vars that @libsql/client reads internally
    if (!process.env.TURSO_DATABASE_URL) {
      process.env.TURSO_DATABASE_URL = realDbUrl
    }
    if (!process.env.TURSO_AUTH_TOKEN && authToken) {
      process.env.TURSO_AUTH_TOKEN = authToken
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

    // Create libsql client with the REAL Turso URL
    const libsql = createClient({
      url: realDbUrl,
      authToken: authToken || undefined,
    })

    const adapter = new PrismaLibSQL(libsql)

    // Do NOT pass datasourceUrl — it's incompatible with driver adapters.
    // Prisma will use the dummy `file:./dev.db` from process.env for
    // validation only; all actual queries go through the adapter.
    return new PrismaClient({
      adapter,
      log: ['error'],
    })
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
