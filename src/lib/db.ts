// ─────────────────────────────────────────────────────────────────────────────
// Database Client Module
// ─────────────────────────────────────────────────────────────────────────────
//
// IMPORTANT: PrismaLibSQL is a FACTORY, not a wrapper class!
// It expects a config object { url, authToken }, NOT a libsql client instance.
// The factory creates its own libsql client internally via connect().
//
// HOW IT WORKS:
// 1. instrumentation.ts runs first: saves real Turso URL, sets safe fallback
// 2. This module uses lazy Proxy — PrismaClient created on first query
// 3. We pass config to PrismaLibSQL factory, which manages its own connections
// 4. For local SQLite, we use absolute paths to avoid CWD resolution issues
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client'
import path from 'path'

type DB = PrismaClient

function createDb(): DB {
  // SAFETY NET: Ensure DATABASE_URL has a valid value before loading Prisma.
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'undefined') {
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }

  // Dynamic require — runs at function call time, NOT at module import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql') as any
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client') as any

  if (!PrismaLibSQL || !PrismaClient) {
    throw new Error('[db] Failed to load database dependencies.')
  }

  // Determine the REAL database URL:
  // 1. _TURSO_DATABASE_URL — saved by instrumentation.ts (for Turso)
  // 2. TURSO_DATABASE_URL — standard Turso env var
  // 3. DATABASE_URL — the main env var (libsql:// or file:)
  // 4. Fallback — absolute path to local SQLite for development
  let url =
    process.env._TURSO_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL

  // For local SQLite: convert relative path to absolute path
  // This avoids CWD resolution issues with @libsql/client's nested packages
  if (!url || (!url.startsWith('libsql://') && !url.startsWith('http://') && !url.startsWith('https://'))) {
    const dbPath = path.resolve(process.cwd(), 'db', 'custom.db')
    url = `file:${dbPath}`
  }

  // Auth token for Turso (not needed for local SQLite)
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  // Pass CONFIG OBJECT to PrismaLibSQL factory (NOT a client instance!)
  // The factory creates its own @libsql/client internally.
  const adapterConfig: Record<string, unknown> = { url }
  if (authToken) {
    adapterConfig.authToken = authToken
  }

  const adapter = new PrismaLibSQL(adapterConfig)

  // Create PrismaClient with adapter.
  // NO datasourceUrl — adapter handles ALL database connections.
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  return client
}

// ── Singleton + Lazy Proxy ─────────────────────────────────────────────────

const globalForDb = globalThis as unknown as { _db?: DB }

let _db: DB | undefined

function getDb(): DB {
  if (_db) return _db

  // Dev-only: reuse across HMR
  if (process.env.NODE_ENV !== 'production' && globalForDb._db) {
    _db = globalForDb._db
    return _db
  }

  _db = createDb()

  if (process.env.NODE_ENV !== 'production') {
    globalForDb._db = _db
  }

  return _db
}

// Exported as a Proxy — PrismaClient created lazily on first property access.
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
