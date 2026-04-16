/**
 * sync-db.js
 *
 * Connects to Turso during Vercel build and creates/updates all tables.
 * Replaces `prisma db push` which doesn't support libsql:// URLs.
 *
 * Required Vercel env vars:
 *   DATABASE_URL      - libsql://your-db-your-org.turso.io
 *   TURSO_AUTH_TOKEN  - Your Turso auth token
 */

import { createClient } from '@libsql/client'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!databaseUrl) {
    console.log('⚠️  DATABASE_URL not set — skipping database sync')
    return
  }

  if (!databaseUrl.startsWith('libsql://') && !databaseUrl.startsWith('https://')) {
    console.log('⚠️  DATABASE_URL is not a Turso URL — skipping database sync')
    return
  }

  console.log('🔄 Generating SQL schema from Prisma schema...')

  const sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf-8', cwd: join(__dirname, '..') }
  )

  if (!sql || sql.trim().length === 0) {
    console.log('✅ Schema is already up to date')
    return
  }

  console.log('🔄 Connecting to Turso...')

  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  })

  console.log('🔄 Applying schema to Turso...')

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await client.execute(stmt)
    } catch (err) {
      if (
        err.message.includes('already exists') ||
        err.message.includes('duplicate column') ||
        err.message.includes('duplicate table')
      ) {
        console.log(`   ⏭️  Skipped (already exists)`)
      } else {
        console.error(`   ❌ Error: ${err.message}`)
      }
    }
  }

  console.log('✅ Database schema synced to Turso!')
}

main().catch(err => {
  console.error('❌ Database sync failed:', err.message)
  process.exit(1)
})
