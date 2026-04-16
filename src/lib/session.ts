/**
 * Session utilities for Vercel serverless deployment.
 * Uses stateless signed tokens (not in-memory Maps which don't persist across invocations).
 *
 * Token format: base64url(JSON payload).base64url(HMAC-SHA256 signature)
 * Payload: { userId, role, exp }
 */

import { createHmac, randomUUID } from 'node:crypto'

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
  return secret
}

function base64urlEncode(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function base64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
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
  const payloadB64 = base64urlEncode(payloadStr)

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

    // Verify signature
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

    // Decode payload
    const payloadStr = base64urlDecode(payloadB64)
    const payload: SessionPayload = JSON.parse(payloadStr)

    // Check expiry
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Edge-compatible token verification (for middleware).
 * Uses Web Crypto API instead of Node's crypto.
 */
export async function verifyTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts
    const secret = getSecret()

    // Decode signature from base64url
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const keyBytes = Uint8Array.from(new TextEncoder().encode(secret))

    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Verify signature
    const payloadBuffer = new TextEncoder().encode(payloadB64)
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, payloadBuffer)
    if (!valid) return null

    // Decode payload
    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload: SessionPayload = JSON.parse(payloadStr)

    // Check expiry
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
