// ─────────────────────────────────────────────────────────────────────────────
// Next.js Instrumentation — runs BEFORE any server code or module imports
// ─────────────────────────────────────────────────────────────────────────────
//
// This is a SAFETY NET. The main fix is in db.ts which always uses the
// libsql adapter and never lets Prisma resolve any URL.
//
// This file ensures:
// 1. DATABASE_URL always has a valid value (prevents 'undefined' caching)
// 2. The real Turso URL is saved in _TURSO_DATABASE_URL for db.ts to use
// ─────────────────────────────────────────────────────────────────────────────

export async function register() {
  // Ensure DATABASE_URL has a valid value before any module loads
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'undefined') {
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }

  const realUrl = process.env.DATABASE_URL || ''

  if (realUrl.startsWith('libsql://')) {
    // Save real Turso URL so db.ts can use it for the adapter
    process.env._TURSO_DATABASE_URL = realUrl
    process.env.TURSO_DATABASE_URL = realUrl

    if (process.env.DATABASE_AUTH_TOKEN) {
      process.env.TURSO_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN
    }

    // Overwrite DATABASE_URL with a safe SQLite URL.
    // This is a safety net in case anything reads DATABASE_URL directly.
    // db.ts uses _TURSO_DATABASE_URL for the real connection.
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }
}
