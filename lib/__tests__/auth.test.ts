import { describe, it, expect, beforeEach, vi } from 'vitest'

// Auth depends on env vars. We set them before each import and reset the
// module registry between tests for isolation.
const TEST_PASSWORD = 'correct-horse-battery-staple'
const TEST_SECRET = 'a'.repeat(64)

async function importAuth() {
  vi.resetModules()
  return import('@/lib/auth')
}

describe('issueSessionToken / verifySessionToken', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('issues a token with payload.signature format', async () => {
    const { issueSessionToken } = await importAuth()
    const token = issueSessionToken()
    // Format: base64url(payload).base64url(hmac) — exactly one dot separator
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('verifies a freshly-issued token', async () => {
    const { issueSessionToken, verifySessionToken } = await importAuth()
    const token = issueSessionToken()
    expect(verifySessionToken(token)).toBe(true)
  })

  it('issues different tokens across time (embedded iat differs)', async () => {
    const { issueSessionToken } = await importAuth()
    const a = issueSessionToken()
    // Force a different second
    await new Promise((r) => setTimeout(r, 1100))
    const b = issueSessionToken()
    expect(a).not.toBe(b)
    // Both should verify (same secret)
    const { verifySessionToken } = await importAuth()
    expect(verifySessionToken(a)).toBe(true)
    expect(verifySessionToken(b)).toBe(true)
  })

  it('rejects a token signed with a different secret', async () => {
    const { issueSessionToken } = await importAuth()
    const token = issueSessionToken()
    process.env.AUTH_SECRET = 'b'.repeat(64)
    const { verifySessionToken } = await importAuth()
    expect(verifySessionToken(token)).toBe(false)
  })

  it('rejects a token signed with a different password', async () => {
    const { issueSessionToken } = await importAuth()
    const token = issueSessionToken()
    process.env.ACCESS_PASSWORD = 'different'
    const { verifySessionToken } = await importAuth()
    expect(verifySessionToken(token)).toBe(false)
  })

  it('rejects a malformed token (no dot)', async () => {
    const { verifySessionToken } = await importAuth()
    expect(verifySessionToken('not-a-valid-token')).toBe(false)
  })

  it('rejects a token with a tampered payload', async () => {
    const { issueSessionToken, verifySessionToken } = await importAuth()
    const token = issueSessionToken()
    const [payload, sig] = token.split('.')
    // Flip a character in the payload — HMAC will no longer match
    const tampered = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A')
    expect(verifySessionToken(`${tampered}.${sig}`)).toBe(false)
  })

  it('rejects a token with a tampered signature', async () => {
    const { issueSessionToken, verifySessionToken } = await importAuth()
    const token = issueSessionToken()
    const [payload] = token.split('.')
    expect(verifySessionToken(`${payload}.aGaveWRvbmdzaWduYXR1cmU`)).toBe(false)
  })

  it('rejects an expired token', async () => {
    const { verifySessionToken, SESSION_MAX_AGE_SEC, issueSessionToken } = await importAuth()
    // Forge a token issued SESSION_MAX_AGE_SEC + 1 second ago.
    // Re-sign manually using the same key derivation would need internals,
    // so instead: mock Date to fast-forward past expiry on a real token.
    const token = issueSessionToken()
    const realNow = Date.now
    Date.now = () => realNow() + (SESSION_MAX_AGE_SEC + 10) * 1000
    try {
      expect(verifySessionToken(token)).toBe(false)
    } finally {
      Date.now = realNow
    }
  })

  it('throws when env vars are missing during issue', async () => {
    delete process.env.ACCESS_PASSWORD
    const { issueSessionToken } = await importAuth()
    expect(() => issueSessionToken()).toThrow(/ACCESS_PASSWORD and AUTH_SECRET/)
  })

  it('verify returns false (not throw) when env missing', async () => {
    const { issueSessionToken } = await importAuth()
    const token = issueSessionToken()
    delete process.env.AUTH_SECRET
    const { verifySessionToken } = await importAuth()
    expect(() => verifySessionToken(token)).not.toThrow()
    expect(verifySessionToken(token)).toBe(false)
  })
})

describe('verifyPassword', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('accepts the correct password', async () => {
    const { verifyPassword } = await importAuth()
    expect(verifyPassword(TEST_PASSWORD)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const { verifyPassword } = await importAuth()
    expect(verifyPassword('wrong')).toBe(false)
  })

  it('rejects an empty password', async () => {
    const { verifyPassword } = await importAuth()
    expect(verifyPassword('')).toBe(false)
  })
})

describe('readSessionToken', () => {
  it('reads the session cookie from a Cookie header', async () => {
    const { readSessionToken, SESSION_COOKIE } = await importAuth()
    const header = `other=value; ${SESSION_COOKIE}=abc123; foo=bar`
    expect(readSessionToken(header)).toBe('abc123')
  })

  it('returns undefined when the cookie is absent', async () => {
    const { readSessionToken } = await importAuth()
    expect(readSessionToken('other=value')).toBeUndefined()
  })

  it('returns undefined for a null header', async () => {
    const { readSessionToken } = await importAuth()
    expect(readSessionToken(null)).toBeUndefined()
  })

  it('returns undefined for an empty header', async () => {
    const { readSessionToken } = await importAuth()
    expect(readSessionToken('')).toBeUndefined()
  })

  it('handles cookie values containing "=" (e.g. base64 tokens)', async () => {
    const { readSessionToken, SESSION_COOKIE } = await importAuth()
    const header = `${SESSION_COOKIE}=dGVzdA==`
    expect(readSessionToken(header)).toBe('dGVzdA==')
  })
})

describe('isAuthenticated', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('returns true when the cookie is a valid issued token', async () => {
    const { isAuthenticated, issueSessionToken, SESSION_COOKIE } = await importAuth()
    const header = `${SESSION_COOKIE}=${issueSessionToken()}`
    expect(isAuthenticated(header)).toBe(true)
  })

  it('returns false when the cookie is a random string', async () => {
    const { isAuthenticated, SESSION_COOKIE } = await importAuth()
    const header = `${SESSION_COOKIE}=not-the-real-token`
    expect(isAuthenticated(header)).toBe(false)
  })

  it('returns false when there is no cookie header', async () => {
    const { isAuthenticated } = await importAuth()
    expect(isAuthenticated(null)).toBe(false)
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('returns null when authenticated', async () => {
    const { requireAuth, issueSessionToken, SESSION_COOKIE } = await importAuth()
    const req = new Request('http://localhost/api/files', {
      headers: { cookie: `${SESSION_COOKIE}=${issueSessionToken()}` },
    })
    expect(requireAuth(req)).toBeNull()
  })

  it('returns a 401 response when unauthenticated', async () => {
    const { requireAuth } = await importAuth()
    const req = new Request('http://localhost/api/files')
    const denied = requireAuth(req)
    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(401)
    const body = await denied!.json()
    expect(body.error).toBe('Unauthorized')
  })
})

describe('isSecureRequest', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  // Determines the session cookie's Secure flag. A bare `next start` over HTTP
  // cannot store a Secure cookie, so the flag must follow the real protocol.

  it('returns false for a direct HTTP request', async () => {
    const { isSecureRequest } = await importAuth()
    const req = new Request('http://localhost/api/auth')
    expect(isSecureRequest(req)).toBe(false)
  })

  it('returns true for a direct HTTPS request', async () => {
    const { isSecureRequest } = await importAuth()
    const req = new Request('https://localhost/api/auth')
    expect(isSecureRequest(req)).toBe(true)
  })

  it('returns true behind a TLS-terminating proxy (x-forwarded-proto: https)', async () => {
    const { isSecureRequest } = await importAuth()
    // Proxies terminate TLS then forward over plain HTTP.
    const req = new Request('http://localhost/api/auth', {
      headers: { 'x-forwarded-proto': 'https' },
    })
    expect(isSecureRequest(req)).toBe(true)
  })

  it('takes the first token of a comma-separated x-forwarded-proto', async () => {
    const { isSecureRequest } = await importAuth()
    const req = new Request('http://localhost/api/auth', {
      headers: { 'x-forwarded-proto': 'https, http' },
    })
    expect(isSecureRequest(req)).toBe(true)
  })

  it('returns false when x-forwarded-proto is http', async () => {
    const { isSecureRequest } = await importAuth()
    const req = new Request('https://localhost/api/auth', {
      headers: { 'x-forwarded-proto': 'http' },
    })
    expect(isSecureRequest(req)).toBe(false)
  })

  it('falls back to the URL scheme when x-forwarded-proto is absent', async () => {
    const { isSecureRequest } = await importAuth()
    const req = new Request('https://localhost/api/auth')
    expect(isSecureRequest(req)).toBe(true)
  })
})
