#!/usr/bin/env node

/**
 * build.js
 *
 * Wraps the Vercel build process:
 * 1. Runs `prisma generate` with a dummy file: URL (so validation passes)
 * 2. Runs `sync-db.js` to push schema to Turso
 * 3. Runs `next build`
 *
 * The real DATABASE_URL (libsql://) is only used at runtime via the adapter.
 */

import { execSync } from 'node:child_process'

console.log('=== Step 1: Generating Prisma Client ===')
// prisma generate only generates code — it doesn't connect to any database.
// We override DATABASE_URL with a dummy file: URL so the SQLite provider validation passes.
try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'file:./db/dummy.db',
    },
  })
} catch (err) {
  console.error('❌ Prisma generate failed:', err.message)
  process.exit(1)
}

console.log('\n=== Step 2: Syncing schema to Turso ===')
try {
  execSync('node scripts/sync-db.js', {
    stdio: 'inherit',
    env: process.env, // uses real DATABASE_URL + TURSO_AUTH_TOKEN from Vercel
  })
} catch (err) {
  console.error('❌ Database sync failed:', err.message)
  process.exit(1)
}

console.log('\n=== Step 3: Building Next.js ===')
try {
  execSync('npx next build', {
    stdio: 'inherit',
    env: process.env,
  })
} catch (err) {
  console.error('❌ Next.js build failed:', err.message)
  process.exit(1)
}

console.log('\n✅ Build completed successfully!')
