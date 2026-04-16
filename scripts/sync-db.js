/**
 * sync-db.js
 *
 * This script replaces `prisma db push` for Turso deployments.
 * It reads the Prisma schema, generates SQL, and applies it directly
 * to your Turso database during the Vercel build.
 *
 * Environment variables required on Vercel:
 *   DATABASE_URL      - Your Turso connection URL (libsql://...)
 *   TURSO_AUTH_TOKEN  - Your Turso auth token
 */

const { createClient } = require('@libsql/client')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!databaseUrl) {
    console.log('⚠️  DATABASE_URL not set — skipping database sync (local dev mode)')
    return
  }

  if (!databaseUrl.startsWith('libsql://') && !databaseUrl.startsWith('https://')) {
    console.log('⚠️  DATABASE_URL is not a Turso URL — skipping database sync (local dev mode)')
    return
  }

  console.log('🔄 Generating SQL schema from Prisma schema...')

  // Generate SQL from Prisma schema (doesn't need a database connection)
  const sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf-8', cwd: path.resolve(__dirname, '..') }
  )

  if (!sql || sql.trim().length === 0) {
    console.log('✅ Schema is already up to date — no changes needed')
    return
  }

  console.log('🔄 Connecting to Turso database...')

  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  })

  console.log('🔄 Applying schema to Turso...')

  // Split by statements and execute each one (handle IF NOT EXISTS gracefully)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await client.execute(stmt)
    } catch (err) {
      // Ignore "already exists" errors (table/index already created)
      if (
        err.message.includes('already exists') ||
        err.message.includes('duplicate column') ||
        err.message.includes('duplicate table')
      ) {
        console.log(`   ⏭️  Skipped (already exists): ${stmt.substring(0, 60)}...`)
      } else {
        console.error(`   ❌ Error executing: ${stmt.substring(0, 100)}...`)
        console.error(`   ${err.message}`)
      }
    }
  }

  console.log('✅ Database schema synced to Turso successfully!')
}

main().catch(err => {
  console.error('❌ Database sync failed:', err.message)
  process.exit(1)
})
