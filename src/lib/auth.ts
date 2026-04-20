import { createHash } from 'crypto'
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

// Use Node.js native crypto instead of crypto.subtle (unreliable on Vercel serverless)
export function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'ss-electricals-salt-2024').digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
