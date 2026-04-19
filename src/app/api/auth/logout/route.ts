import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const session = await getSession()
    if (session) {
      await db.user.update({
        where: { id: session.id },
        data: { token: null, tokenExpiry: null },
      })
    }

    const response = NextResponse.json({ success: true })
    response.headers.set('Set-Cookie', 'token=; Path=/; HttpOnly; Max-Age=0')
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
