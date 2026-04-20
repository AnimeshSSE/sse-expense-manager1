import { NextResponse } from 'next/server'

// Diagnostic endpoint — tests each component to find Vercel deployment issues.
// Run: GET /api/debug
export async function GET() {
  const results: Record<string, { status: string; detail: string }> = {}

  // Test 1: Node.js crypto
  try {
    const { createHash } = await import('crypto')
    const hash = createHash('sha256').update('test123').digest('hex')
    results.crypto = { status: 'OK', detail: `SHA-256: ${hash.slice(0, 12)}...` }
  } catch (e) {
    results.crypto = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 2: Environment variables
  const dbUrl = process.env.DATABASE_URL || ''
  const dbToken = process.env.DATABASE_AUTH_TOKEN || ''
  results.env = {
    status: dbUrl ? 'OK' : 'FAIL',
    detail: `DATABASE_URL="${dbUrl.slice(0, 50)}${dbUrl.length > 50 ? '...' : ''}" (${dbUrl.length} chars), TOKEN="${dbToken ? 'SET' : 'NOT SET'}", NODE_ENV="${process.env.NODE_ENV || 'NOT SET'}"`,
  }

  // Test 3: @prisma/client loads
  try {
    await import('@prisma/client')
    results.prismaClient = { status: 'OK', detail: 'Loaded' }
  } catch (e) {
    results.prismaClient = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 4: @prisma/adapter-libsql loads
  try {
    const mod = await import('@prisma/adapter-libsql')
    results.prismaAdapter = { status: 'OK', detail: `Exports: ${Object.keys(mod).join(', ')}` }
  } catch (e) {
    results.prismaAdapter = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 5: @libsql/client loads
  try {
    const mod = await import('@libsql/client')
    results.libsqlClient = { status: 'OK', detail: `Exports: ${Object.keys(mod).join(', ')}` }
  } catch (e) {
    results.libsqlClient = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 6: Direct DB connection test (same logic as db.ts)
  try {
    if (dbUrl.startsWith('libsql://')) {
      process.env.TURSO_DATABASE_URL = dbUrl
      if (dbToken) process.env.TURSO_AUTH_TOKEN = dbToken

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaLibSQL } = require('@prisma/adapter-libsql') as any
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClient } = require('@libsql/client') as any
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client') as any

      const libsql = createClient({ url: dbUrl, authToken: dbToken || undefined })
      const adapter = new PrismaLibSQL(libsql)
      const testClient = new PrismaClient({ adapter })
      const count = await testClient.user.count()
      await testClient.$disconnect()
      results.dbConnection = { status: 'OK', detail: `Turso connected. Users: ${count}` }
    } else if (dbUrl.startsWith('file:')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client') as any
      const testClient = new PrismaClient({ datasourceUrl: dbUrl })
      const count = await testClient.user.count()
      await testClient.$disconnect()
      results.dbConnection = { status: 'OK', detail: `SQLite file. Users: ${count}` }
    } else {
      results.dbConnection = { status: 'SKIP', detail: `Unknown URL type: ${dbUrl.slice(0, 15)}` }
    }
  } catch (e) {
    results.dbConnection = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  // Test 7: Auth (hashing)
  try {
    const auth = await import('@/lib/auth')
    const hash = auth.hashPassword('admin123')
    const valid = auth.verifyPassword('admin123', hash)
    results.auth = { status: valid ? 'OK' : 'FAIL', detail: `Hash: ${hash.slice(0, 12)}...` }
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

  // Test 9: db module (the actual one the app uses)
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    results.dbModule = { status: 'OK', detail: `Users: ${count}` }
  } catch (e) {
    results.dbModule = { status: 'FAIL', detail: String(e instanceof Error ? e.message : e) }
  }

  const allOk = Object.values(results).every(r => r.status === 'OK')

  return NextResponse.json(
    {
      overall: allOk ? 'ALL CHECKS PASSED' : 'ERRORS DETECTED',
      timestamp: new Date().toISOString(),
      tests: results,
    },
    { status: allOk ? 200 : 500 }
  )
}
