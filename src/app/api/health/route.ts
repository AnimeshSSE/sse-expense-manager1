import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'

export async function GET() {
  const checks: Record<string, string> = {}

  // Check 1: Node.js crypto
  try {
    const hash = hashPassword('test')
    checks.crypto = `OK (sha256 works, hash=${hash.slice(0, 8)}...)`
  } catch (e) {
    checks.crypto = `FAILED: ${e instanceof Error ? e.message : String(e)}`
  }

  // Check 2: Password verify
  try {
    const hash = hashPassword('admin123')
    const valid = verifyPassword('admin123', hash)
    checks.passwordVerify = valid ? 'OK' : 'FAILED: hash mismatch'
  } catch (e) {
    checks.passwordVerify = `FAILED: ${e instanceof Error ? e.message : String(e)}`
  }

  // Check 3: Database connection
  try {
    const count = await db.user.count()
    checks.database = `OK (${count} users)`
  } catch (e) {
    checks.database = `FAILED: ${e instanceof Error ? e.message : String(e)}`
  }

  // Check 4: Environment
  checks.databaseUrl = (process.env.DATABASE_URL || 'NOT SET').slice(0, 30) + '...'
  checks.nodeEnv = process.env.NODE_ENV || 'NOT SET'

  const hasErrors = Object.values(checks).some(v => v.startsWith('FAILED'))

  return NextResponse.json(
    { status: hasErrors ? 'error' : 'ok', timestamp: new Date().toISOString(), checks },
    { status: hasErrors ? 500 : 200 }
  )
}
