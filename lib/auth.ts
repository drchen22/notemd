import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

/** Cookie name holding the session token. */
export const SESSION_COOKIE = 'session'

/**
 * Session lifetime in seconds. Tokens older than this are rejected.
 * (Was 30 days as a plain cookie maxAge; now enforced inside the token too,
 * so changing AUTH_SECRET or waiting past this window invalidates sessions.)
 */
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60 // 7 days

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

// ── HMAC signing helpers ───────────────────────────────────────────────

/** Base64url-encode a Buffer (no padding), safe inside a cookie value. */
function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Derive the HMAC key from the configured secret. */
function hmacKey(): Buffer {
  // Include the password in the key so changing the password also invalidates
  // all outstanding tokens (not just the secret).
  const { secret, password } = getAuthConfig()
  return Buffer.from(`${secret}:${password}`)
}

/** Compute the HMAC tag for a given payload string. */
function sign(payload: string): Buffer {
  return createHmac('sha256', hmacKey()).update(payload).digest()
}

/**
 * Issue a signed session token embedding the issue time.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`
 * where payload is `JSON.stringify({ iat })`.
 *
 * Stateless: there is no server-side session record. Revocation happens by:
 *   - natural expiry (iat older than SESSION_MAX_AGE_SEC), or
 *   - changing AUTH_SECRET / ACCESS_PASSWORD (HMAC verification fails).
 */
export function issueSessionToken(): string {
  const iat = Math.floor(Date.now() / 1000)
  const payload = b64url(Buffer.from(JSON.stringify({ iat })))
  const tag = b64url(sign(payload))
  return `${payload}.${tag}`
}

/**
 * Verify a session token: HMAC must be valid AND the token must not be older
 * than SESSION_MAX_AGE_SEC. Returns true on a valid, unexpired token.
 */
export function verifySessionToken(token: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot <= 0 || dot === token.length - 1) return false
  const payload = token.slice(0, dot)
  const tag = token.slice(dot + 1)

  let expectedTag: Buffer
  try {
    expectedTag = sign(payload)
  } catch {
    // getAuthConfig threw — env not configured
    return false
  }

  // Constant-time comparison of the HMAC tags.
  const given = Buffer.from(tag, 'base64url')
  if (given.length !== expectedTag.length) return false
  if (!timingSafeEqual(given, expectedTag)) return false

  // Check expiry.
  try {
    const { iat } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { iat: number }
    const age = Math.floor(Date.now() / 1000) - iat
    return age >= 0 && age < SESSION_MAX_AGE_SEC
  } catch {
    return false
  }
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

/** True if the request's session cookie is a valid, unexpired token. */
export function isAuthenticated(cookieHeader: string | null): boolean {
  const token = readSessionToken(cookieHeader)
  if (!token) return false
  return verifySessionToken(token)
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

/**
 * Whether a request arrived over a secure (HTTPS) context.
 *
 * Used to decide the session cookie's `Secure` flag. The flag must NOT be
 * hard-coded from NODE_ENV: a production instance served over plain HTTP
 * (e.g. bare `next start` with no TLS-terminating proxy) cannot store a
 * `Secure` cookie, so the browser silently drops it and the user can never
 * get past login. Deriving it from the actual request protocol keeps it
 * correct in both cases.
 *
 * Detection order:
 *   1. `X-Forwarded-Proto` — authoritative when behind a TLS-terminating
 *      proxy (the future NAS / tunnel deployment). Takes the first token.
 *   2. The request URL scheme — for direct (no-proxy) connections.
 */
export function isSecureRequest(
  request: Pick<Request, 'url' | 'headers'>,
): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim().toLowerCase()
    if (first === 'https') return true
    if (first === 'http') return false
  }
  return new URL(request.url).protocol === 'https:'
}
