// ─────────────────────────────────────────────────────────────────────────────
// Next.js Instrumentation
// ─────────────────────────────────────────────────────────────────────────────
// This file runs BEFORE any server code, any module imports, any API routes.
// It is the very first code that executes in the Next.js server process.
//
// CRITICAL FOR VERCEL + TURSO:
// Prisma's generated client resolves the schema datasource URL at module load
// time. In Vercel standalone builds, this can fail and cache 'undefined'.
//
// By setting DATABASE_URL here (before any @prisma/client import happens),
// we guarantee Prisma always finds a valid URL for schema validation.
// The actual Turso connection is handled by the driver adapter, not this URL.
// ─────────────────────────────────────────────────────────────────────────────

export async function register() {
  const realUrl = process.env.DATABASE_URL || ''

  if (realUrl.startsWith('libsql://')) {
    // Production: Store real Turso URL for the adapter to use later
    process.env.TURSO_DATABASE_URL = realUrl
    if (process.env.DATABASE_AUTH_TOKEN) {
      process.env.TURSO_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN
    }
    // Override DATABASE_URL with safe SQLite URL for Prisma schema validation.
    // The adapter (libsql) handles the actual Turso connection.
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }
}
