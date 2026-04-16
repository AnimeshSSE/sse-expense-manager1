/**
 * Edge-compatible token verification for middleware.
 * Uses Web Crypto API only (no node:crypto).
 */

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

export async function verifyTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts
    const secret = getSecret()

    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )
    const keyBytes = new TextEncoder().encode(secret)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const payloadBuffer = new TextEncoder().encode(payloadB64)
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, payloadBuffer)
    if (!valid) return null

    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload: SessionPayload = JSON.parse(payloadStr)

    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
