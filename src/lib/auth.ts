import { db } from './db'
import { cookies } from 'next/headers'

export interface Session {
  id: string
  email: string
  name: string
  role: string
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null

  try {
    const user = await db.user.findUnique({
      where: { token },
      select: { id: true, email: true, name: true, role: true, tokenExpiry: true, isActive: true },
    })
    if (!user || !user.isActive) return null
    if (user.tokenExpiry && user.tokenExpiry < new Date()) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'ss-electricals-salt-2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}
