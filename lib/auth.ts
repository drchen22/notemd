import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

/** Cookie name holding the session token. */
export const SESSION_COOKIE = 'session'

/**
 * Read ACCESS_PASSWORD / AUTH_SECRET from the environment.
 * Both MUST be set — there is no insecure hardcoded fallback.
 */
function getAuthConfig() {
  const password = process.env.ACCESS_PASSWORD
  const secret = process.env.AUTH_SECRET
  if (!password || !secret) {
    throw new Error(
      'ACCESS_PASSWORD and AUTH_SECRET environment variables must be set. ' +
        'Generate a secret with: openssl rand -hex 32',
    )
  }
  return { password, secret }
}

/** Derive the expected session token from the configured password + secret. Cached after first use. */
let cachedToken: string | null = null
export function sessionToken(): string {
  if (cachedToken !== null) return cachedToken
  const { password, secret } = getAuthConfig()
  cachedToken = createHash('sha256')
    .update(`${password}${secret}`)
    .digest('hex')
  return cachedToken
}

/** Constant-time string comparison that tolerates unequal lengths. */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  // Keep the comparison work roughly constant regardless of match position.
  const ok = aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
  return ok
}

/** Verify a submitted password against the configured one (login). */
export function verifyPassword(submitted: string): boolean {
  try {
    return safeEqual(submitted, getAuthConfig().password)
  } catch {
    return false
  }
}

/** Read the `session` cookie value from a raw Cookie header. */
export function readSessionToken(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/** True if the request's session cookie matches the configured token. */
export function isAuthenticated(cookieHeader: string | null): boolean {
  const token = readSessionToken(cookieHeader)
  if (!token) return false
  try {
    return safeEqual(token, sessionToken())
  } catch {
    return false
  }
}

/**
 * Route-handler guard (defense in depth alongside proxy.ts).
 * Returns a 401 response when unauthenticated, or `null` when OK —
 * usage: `const denied = requireAuth(request); if (denied) return denied`
 */
export function requireAuth(request: Request): NextResponse | null {
  return isAuthenticated(request.headers.get('cookie'))
    ? null
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
