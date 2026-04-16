/**
 * Session utilities for Vercel deployment.
 * Uses stateless signed tokens with Web Crypto API (works in both Edge + Node.js).
 *
 * Token format: base64url(JSON payload).base64url(HMAC-SHA256 signature)
 * Payload: { userId, role, exp }
 */

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
  return secret
}

function base64urlEncode(data: Uint8Array | string): string {
  if (typeof data === 'string') {
    data = new TextEncoder().encode(data)
  }
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlDecode(data: string): Uint8Array {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(padded)
  return Uint8Array.from(decoded, c => c.charCodeAt(0))
}

export interface SessionPayload {
  userId: string
  role: string
  exp: number
}

async function getSigningKey(): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(getSecret())
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Create a signed session token.
 */
export async function createToken(userId: string, role: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Date.now() + TOKEN_EXPIRY,
  }

  const payloadStr = JSON.stringify(payload)
  const payloadB64 = base64urlEncode(payloadStr)

  const key = await getSigningKey()
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64)
  )
  const signature = base64urlEncode(signatureBuffer)

  return `${payloadB64}.${signature}`
}

/**
 * Verify and decode a session token.
 * Returns the payload if valid, null if expired or tampered.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts

    const key = await getSigningKey()
    const sigBytes = base64urlDecode(signature)
    const payloadBuffer = new TextEncoder().encode(payloadB64)

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBuffer)
    if (!valid) return null

    // Decode payload
    const payloadBytes = base64urlDecode(payloadB64)
    const payloadStr = new TextDecoder().decode(payloadBytes)
    const payload: SessionPayload = JSON.parse(payloadStr)

    // Check expiry
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
