// ─────────────────────────────────────────────────────────────────────────────
// Database Client Module
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW IT WORKS:
//
// 1. instrumentation.ts runs FIRST (before any module loads):
//    - If DATABASE_URL is libsql://, it saves the real URL in _TURSO_DATABASE_URL
//      and overwrites DATABASE_URL with a safe SQLite path for Prisma validation
//
// 2. This module uses _TURSO_DATABASE_URL to decide between Turso vs SQLite:
//    - Turso: creates libsql adapter + PrismaClient({ adapter })
//    - SQLite: creates PrismaClient({ datasourceUrl })
//
// 3. Lazy Proxy pattern: PrismaClient is NOT created at import time.
//    It's created on first query (inside request handler where env vars exist).
//
// 4. import type for PrismaClient ensures @prisma/client never loads at module time.
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client'

type DB = PrismaClient

function createTursoClient(): DB {
  // Read from _TURSO_DATABASE_URL (set by instrumentation.ts)
  // because DATABASE_URL has been overwritten to a SQLite path
  const url = process.env._TURSO_DATABASE_URL || ''
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url.startsWith('libsql://')) {
    throw new Error(
      `[db] _TURSO_DATABASE_URL is not a valid libsql URL: "${url.slice(0, 30)}"`
    )
  }

  // Set fallback env vars that @libsql/client may read internally
  process.env.TURSO_DATABASE_URL = url
  if (authToken) {
    process.env.TURSO_AUTH_TOKEN = authToken
  }

  // Dynamic require — runs at function call time, NOT at module load time
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

  // adapter handles ALL queries. Schema URL (file:./db/custom.db) used for validation only.
  return new PrismaClient({ adapter, log: ['error'] })
}

function createLocalClient(): DB {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client') as any

  return new PrismaClient({
    datasourceUrl: url,
    log: ['error'],
  })
}

// ── Singleton + Lazy Proxy ─────────────────────────────────────────────────

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
    // Check _TURSO_DATABASE_URL (set by instrumentation.ts before any module loads).
    // This is the REAL Turso URL. DATABASE_URL has been overwritten to a SQLite path.
    if (process.env._TURSO_DATABASE_URL?.startsWith('libsql://')) {
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

// Exported as a Proxy — PrismaClient created lazily on first property access
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
