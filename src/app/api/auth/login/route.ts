import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded()

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, password: true, isActive: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    const valid = verifyPassword(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await db.user.update({
      where: { id: user.id },
      data: { token, tokenExpiry, lastLogin: new Date() },
    })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })

    const isSecure = request.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production'
    const secureFlag = isSecure ? '; Secure' : ''

    response.headers.set(
      'Set-Cookie',
      `token=${token}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${30 * 24 * 60 * 60}`
    )

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Login error:', message, error)
    return NextResponse.json({ error: 'Login failed', details: message }, { status: 500 })
  }
}
