/**
 * Authenticated fetch wrapper.
 * Automatically attaches the auth token from localStorage to all API requests.
 */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, { ...options, headers })
}

/**
 * Convenience wrappers
 */
export const authGet = (url: string) => authFetch(url, { method: 'GET' })

export const authPost = (url: string, body: unknown) =>
  authFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const authPut = (url: string, body: unknown) =>
  authFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const authDelete = (url: string) =>
  authFetch(url, { method: 'DELETE' })
