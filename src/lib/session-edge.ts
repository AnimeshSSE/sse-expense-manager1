/**
 * Edge-compatible token verification for middleware.
 * Uses Web Crypto API only (no node:crypto).
 */

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
}

export interface SessionPayload {
  userId: string
  role: string
  exp: number
}

/**
 * Convert base64url string to standard base64 with padding.
 */
function base64urlToBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad === 2) base64 += '=='
  else if (pad === 3) base64 += '='
  return base64
}

export async function verifyTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts
    const secret = getSecret()

    const sigBytes = Uint8Array.from(
      atob(base64urlToBase64(signature)),
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

    const payloadStr = atob(base64urlToBase64(payloadB64))
    const payload: SessionPayload = JSON.parse(payloadStr)

    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
