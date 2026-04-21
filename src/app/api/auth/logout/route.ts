import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (session) {
      await db.user.update({
        where: { id: session.id },
        data: { token: null, tokenExpiry: null },
      })
    }

    const isSecure = request.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production'
    const secureFlag = isSecure ? '; Secure' : ''

    const response = NextResponse.json({ success: true })
    response.headers.set('Set-Cookie', `token=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`)
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
