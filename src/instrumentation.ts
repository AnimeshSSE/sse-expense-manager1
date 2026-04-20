// ─────────────────────────────────────────────────────────────────────────────
// Next.js Instrumentation — runs BEFORE any server code or module imports
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
// Prisma's generated client resolves the schema datasource URL at module load
// time. On Vercel standalone builds with libsql:// URLs, this can fail and
// cache 'undefined'. Setting a safe fallback URL here prevents that.
//
// HOW IT WORKS:
// 1. If DATABASE_URL is a Turso (libsql://) URL:
//    - Save it to _TURSO_DATABASE_URL so db.ts knows to use the adapter
//    - Set DATABASE_URL to a safe SQLite path for Prisma schema validation
// 2. If DATABASE_URL is already a file:// path: do nothing (local dev)
// ─────────────────────────────────────────────────────────────────────────────

export async function register() {
  const realUrl = process.env.DATABASE_URL || ''

  if (realUrl.startsWith('libsql://')) {
    // Store real Turso URL in a separate var so db.ts can detect Turso mode
    // even after we overwrite DATABASE_URL below
    process.env._TURSO_DATABASE_URL = realUrl
    process.env.TURSO_DATABASE_URL = realUrl

    if (process.env.DATABASE_AUTH_TOKEN) {
      process.env.TURSO_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN
    }

    // Overwrite DATABASE_URL with a safe SQLite URL.
    // Prisma uses this ONLY for schema validation (provider/sqlite format check).
    // The actual Turso connection is handled by the adapter in db.ts.
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }
}
