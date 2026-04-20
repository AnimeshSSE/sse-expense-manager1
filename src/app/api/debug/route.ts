import { NextResponse } from 'next/server'

// ZERO external deps. Tests each component individually to find failures on Vercel.
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

  // Test 2: Environment variables — capture BEFORE any code overwrites them
  const realDbUrl = process.env.DATABASE_URL || ''
  const dbToken = process.env.DATABASE_AUTH_TOKEN || ''
  results.env = {
    status: realDbUrl ? 'OK' : 'FAIL',
    detail: `DATABASE_URL="${realDbUrl.slice(0, 50)}${realDbUrl.length > 50 ? '...' : ''}" (${realDbUrl.length} chars), DATABASE_AUTH_TOKEN="${dbToken ? 'SET (' + dbToken.length + ' chars)' : 'NOT SET'}", NODE_ENV="${process.env.NODE_ENV || 'NOT SET'}", TURSO_DATABASE_URL="${process.env.TURSO_DATABASE_URL || 'NOT SET'}"`
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
    results.prismaAdapter = { status: 'OK', detail: `Exports: ${Object.keys(mod).join(', ')}` }
  } catch (e) {
    results.prismaAdapter = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 5: @libsql/client
  try {
    const mod = await import('@libsql/client')
    results.libsqlClient = { status: 'OK', detail: `Exports: ${Object.keys(mod).join(', ')}` }
  } catch (e) {
    results.libsqlClient = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 6: DB connection via adapter
  try {
    if (realDbUrl.startsWith('libsql://')) {
      // Set fallback env vars for @libsql/client
      if (!process.env.TURSO_DATABASE_URL) process.env.TURSO_DATABASE_URL = realDbUrl
      if (!process.env.TURSO_AUTH_TOKEN && dbToken) process.env.TURSO_AUTH_TOKEN = dbToken

      // CRITICAL: Set DATABASE_URL to a valid dummy SQLite URL so Prisma's
      // schema validation passes. datasourceUrl is NOT allowed with adapters.
      process.env.DATABASE_URL = 'file:./dev.db'

      const { PrismaClient } = await import('@prisma/client')
      const adapterMod = await import('@prisma/adapter-libsql')
      const libsqlMod = await import('@libsql/client')
      const PrismaLibSQL = (adapterMod as any).PrismaLibSQL || (adapterMod as any).default
      const createClientFn = (libsqlMod as any).createClient || (libsqlMod as any).default?.createClient

      // Connect libsql client to the REAL Turso URL
      const libsql = createClientFn({ url: realDbUrl, authToken: dbToken || undefined })
      const adapter = new PrismaLibSQL(libsql)

      // No datasourceUrl — adapter handles the connection
      const testDb = new PrismaClient({ adapter })
      const count = await testDb.user.count()
      await testDb.$disconnect()
      results.dbConnection = { status: 'OK', detail: `Connected. Users: ${count}` }
    } else if (realDbUrl.startsWith('file:')) {
      const { PrismaClient } = await import('@prisma/client')
      const testDb = new PrismaClient()
      const count = await testDb.user.count()
      await testDb.$disconnect()
      results.dbConnection = { status: 'OK', detail: `SQLite file. Users: ${count}` }
    } else {
      results.dbConnection = { status: 'SKIP', detail: `URL type: ${realDbUrl.slice(0, 15)}` }
    }
  } catch (e) {
    results.dbConnection = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 7: Auth
  try {
    const auth = await import('@/lib/auth')
    const hash = auth.hashPassword('admin123')
    results.auth = { status: auth.verifyPassword('admin123', hash) ? 'OK' : 'FAIL', detail: `Hash: ${hash.slice(0, 12)}...` }
  } catch (e) {
    results.auth = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 8: Seed
  try {
    if (results.dbConnection?.status === 'OK') {
      const { ensureSeeded } = await import('@/lib/seed')
      await ensureSeeded()
      results.seed = { status: 'OK', detail: 'Done' }
    } else {
      results.seed = { status: 'SKIP', detail: 'DB failed' }
    }
  } catch (e) {
    results.seed = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 9: db module (the real one the app uses)
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    results.dbModule = { status: 'OK', detail: `Users: ${count}` }
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
