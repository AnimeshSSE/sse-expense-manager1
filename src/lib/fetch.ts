/**
 * Authenticated fetch wrapper.
 * authFetch returns parsed JSON directly.
 * authFetchRaw returns the raw Response (for blob/file downloads).
 */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export async function authFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`
    try {
      const errBody = await res.json()
      if (errBody?.error) errMsg = errBody.error
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg)
  }

  return res.json() as Promise<T>
}

/**
 * Raw fetch — returns Response object (use for blob/file downloads).
 */
export async function authFetchRaw(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, { ...options, headers })
}

export const authGet = <T = unknown>(url: string) =>
  authFetch<T>(url, { method: 'GET' })

export const authPost = <T = unknown>(url: string, body: unknown) =>
  authFetch<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const authPut = <T = unknown>(url: string, body: unknown) =>
  authFetch<T>(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const authDelete = <T = unknown>(url: string) =>
  authFetch<T>(url, { method: 'DELETE' })
