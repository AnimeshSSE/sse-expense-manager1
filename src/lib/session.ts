/**
 * Session utilities for API routes (Node.js runtime).
 * Uses node:crypto for HMAC signing.
 *
 * Token format: base64url(JSON payload).base64url(HMAC-SHA256 signature)
 * Payload: { userId, role, exp }
 */

import { createHmac } from 'node:crypto'

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
  return secret
}

export interface SessionPayload {
  userId: string
  role: string
  exp: number
}

/**
 * Create a signed session token.
 */
export function createToken(userId: string, role: string): string {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Date.now() + TOKEN_EXPIRY,
  }

  const payloadStr = JSON.stringify(payload)
  const payloadB64 = Buffer.from(payloadStr, 'utf-8').toString('base64url')

  const signature = createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url')

  return `${payloadB64}.${signature}`
}

/**
 * Verify and decode a session token.
 * Returns the payload if valid, null if expired or tampered.
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts

    const expectedSignature = createHmac('sha256', getSecret())
      .update(payloadB64)
      .digest('base64url')

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) return null
    let mismatch = 0
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }
    if (mismatch !== 0) return null

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const payload: SessionPayload = JSON.parse(payloadStr)

    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
