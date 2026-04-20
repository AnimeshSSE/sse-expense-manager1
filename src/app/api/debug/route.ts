import { NextResponse } from 'next/server'

// ZERO external dependencies — no prisma, no db, no auth imports.
// Tests each component individually to find the exact failure point on Vercel.
export async function GET() {
  const results: Record<string, { status: string; detail: string }> = {}

  // Test 1: Node.js crypto
  try {
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update('test123').digest('hex')
    results.crypto = { status: 'OK', detail: `SHA-256 produced: ${hash.slice(0, 12)}...` }
  } catch (e) {
    results.crypto = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 2: Environment variables
  const dbUrl = process.env.DATABASE_URL || ''
  const dbToken = process.env.DATABASE_AUTH_TOKEN || ''
  results.env = {
    status: dbUrl ? 'OK' : 'FAIL',
    detail: `DATABASE_URL="${dbUrl.slice(0, 50)}${dbUrl.length > 50 ? '...' : ''}" (${dbUrl.length} chars), DATABASE_AUTH_TOKEN="${dbToken ? 'SET (' + dbToken.length + ' chars)' : 'NOT SET'}", NODE_ENV="${process.env.NODE_ENV || 'NOT SET'}"`
  }

  // Test 3: @prisma/client
  try {
    await import('@prisma/client')
    results.prismaClient = { status: 'OK', detail: 'PrismaClient loaded' }
  } catch (e) {
    results.prismaClient = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 4: @prisma/adapter-libsql
  try {
    const mod = await import('@prisma/adapter-libsql')
    const keys = Object.keys(mod)
    results.prismaAdapter = { status: 'OK', detail: `Loaded. Exports: ${keys.join(', ')}` }
  } catch (e) {
    results.prismaAdapter = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 5: @libsql/client
  try {
    const mod = await import('@libsql/client')
    const keys = Object.keys(mod)
    results.libsqlClient = { status: 'OK', detail: `Loaded. Exports: ${keys.join(', ')}` }
  } catch (e) {
    results.libsqlClient = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 6: DB connection
  try {
    if (dbUrl.startsWith('libsql://') && results.prismaAdapter?.status === 'OK') {
      const { PrismaClient } = await import('@prisma/client')
      const adapterMod = await import('@prisma/adapter-libsql')
      const libsqlMod = await import('@libsql/client')
      const PrismaLibSQL = (adapterMod as any).PrismaLibSQL || (adapterMod as any).default
      const createClient = (libsqlMod as any).createClient || (libsqlMod as any).default?.createClient
      const libsql = createClient({ url: dbUrl, authToken: dbToken || undefined })
      const adapter = new PrismaLibSQL(libsql)
      const testDb = new PrismaClient({ adapter })
      const count = await testDb.user.count()
      await testDb.$disconnect()
      results.dbConnection = { status: 'OK', detail: `Connected. Users: ${count}` }
    } else if (!dbUrl.startsWith('libsql://') && dbUrl.startsWith('file:')) {
      const { PrismaClient } = await import('@prisma/client')
      const testDb = new PrismaClient()
      const count = await testDb.user.count()
      await testDb.$disconnect()
      results.dbConnection = { status: 'OK', detail: `SQLite file mode. Users: ${count}` }
    } else {
      results.dbConnection = { status: 'SKIP', detail: `DB URL type not handled or adapter missing (url starts with: ${dbUrl.slice(0, 10)})` }
    }
  } catch (e) {
    results.dbConnection = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 7: Auth module
  try {
    const auth = await import('@/lib/auth')
    const hash = auth.hashPassword('admin123')
    const valid = auth.verifyPassword('admin123', hash)
    results.auth = { status: valid ? 'OK' : 'FAIL', detail: valid ? `Hash: ${hash.slice(0, 12)}... verify=true` : 'Hash verify returned false' }
  } catch (e) {
    results.auth = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 8: Seed
  try {
    if (results.dbConnection?.status === 'OK') {
      const { ensureSeeded } = await import('@/lib/seed')
      await ensureSeeded()
      results.seed = { status: 'OK', detail: 'Seeded (or already seeded)' }
    } else {
      results.seed = { status: 'SKIP', detail: 'Skipped — DB failed' }
    }
  } catch (e) {
    results.seed = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 9: db module (this is the one that crashes if require() fails)
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    results.dbModule = { status: 'OK', detail: `db module works. Users: ${count}` }
  } catch (e) {
    results.dbModule = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  const allOk = Object.values(results).every(r => r.status === 'OK')

  return NextResponse.json({
    overall: allOk ? 'ALL CHECKS PASSED' : 'ERRORS DETECTED',
    timestamp: new Date().toISOString(),
    tests: results,
  }, { status: allOk ? 200 : 500 })
}
