import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get me error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Failed to get user', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}

// Health check to verify DB connection and seed status
export async function OPTIONS() {
  try {
    const count = await db.user.count()
    return NextResponse.json({ status: 'ok', db: 'connected', userCount: count })
  } catch (error) {
    return NextResponse.json({ status: 'error', db: 'disconnected', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
