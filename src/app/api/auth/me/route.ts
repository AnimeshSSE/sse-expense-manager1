import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
