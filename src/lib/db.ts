// ─────────────────────────────────────────────────────────────────────────────
// Database Client Module
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW IT WORKS:
//
// 1. The Prisma schema has a HARDCODED datasource URL: "file:./db/custom.db"
//    This is critical for Vercel. The generated Prisma client bakes in this
//    URL at build time — it never calls env("DATABASE_URL") at runtime.
//
// 2. For PRODUCTION (Turso via libsql adapter):
//    - The adapter handles ALL database connections
//    - Prisma's hardcoded URL is used only for schema validation
//    - Actual queries go through @prisma/adapter-libsql → @libsql/client
//
// 3. For LOCAL DEV (SQLite file):
//    - We override the schema URL with datasourceUrl option
//    - No adapter needed — Prisma connects directly via better-sqlite3
//
// 4. Lazy Proxy pattern:
//    - PrismaClient is NOT created at module load time
//    - It's created on first query, in the request context where env vars are available
//    - This prevents crashes during Vercel's module bundling/evaluation phase
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client'

type DB = PrismaClient

function createTursoClient(): DB {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (!url || !url.startsWith('libsql://')) {
    throw new Error(
      `[db] Expected DATABASE_URL to start with libsql://, got: "${url?.slice(0, 30) || 'undefined'}"`
    )
  }

  // Set fallback env vars that @libsql/client reads internally
  process.env.TURSO_DATABASE_URL = url
  if (authToken) {
    process.env.TURSO_AUTH_TOKEN = authToken
  }

  // Dynamic require — runs at function call time (inside request handler),
  // NOT at module load time. This ensures env vars are available.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql') as any
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client') as any

  if (!PrismaLibSQL || !createClient) {
    throw new Error('[db] Failed to load @prisma/adapter-libsql or @libsql/client')
  }

  const libsqlClient = createClient({ url, authToken: authToken || undefined })
  const adapter = new PrismaLibSQL(libsqlClient)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client') as any

  // adapter handles the connection. Schema's hardcoded URL passes validation.
  return new PrismaClient({ adapter, log: ['error'] })
}

function createLocalClient(): DB {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client') as any

  // datasourceUrl overrides the schema's hardcoded URL
  return new PrismaClient({
    datasourceUrl: url,
    log: ['error'],
  })
}

// ── Singleton + Proxy ─────────────────────────────────────────────────────

const globalForDb = globalThis as unknown as { _db?: DB }

let _db: DB | undefined
let _initError: Error | undefined

function getDb(): DB {
  if (_db) return _db

  // Dev-only: reuse across HMR
  if (globalForDb._db) {
    _db = globalForDb._db
    return _db
  }

  try {
    const url = process.env.DATABASE_URL || ''

    if (url.startsWith('libsql://')) {
      _db = createTursoClient()
    } else {
      _db = createLocalClient()
    }

    if (process.env.NODE_ENV !== 'production') {
      globalForDb._db = _db
    }

    return _db
  } catch (err) {
    _initError = err instanceof Error ? err : new Error(String(err))
    throw _initError
  }
}

// Exported as a Proxy so the actual PrismaClient is created lazily
// on first property access (i.e., first query), never at import time.
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const actual = getDb()
    const value = Reflect.get(actual, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(actual)
    }
    return value
  },
})
