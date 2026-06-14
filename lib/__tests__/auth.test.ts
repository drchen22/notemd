import { describe, it, expect, beforeEach, vi } from 'vitest'

// Auth depends on two env vars and caches the derived token at module level.
// We set the env before each import and reset the module registry between
// tests so the cache is always fresh.
const TEST_PASSWORD = 'correct-horse-battery-staple'
const TEST_SECRET = 'a'.repeat(64)

async function importAuth() {
  vi.resetModules()
  return import('@/lib/auth')
}

describe('sessionToken', () => {
  beforeEach(() => {
    process.env.ACCESS_PASSWORD = TEST_PASSWORD
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('derives a deterministic SHA256 hex token from password + secret', async () => {
    const { sessionToken } = await importAuth()
    const token = sessionToken()
    // SHA256 hex is 64 chars
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable across calls within the same config (module cache)', async () => {
    const { sessionToken } = await importAuth()
    expect(sessionToken()).toBe(sessionToken())
  })

  it('changes when the password changes', async () => {
    const { sessionToken: tokenA } = await importAuth()
    const a = tokenA()

    process.env.ACCESS_PASSWORD = 'different'
    const { sessionToken: tokenB } = await importAuth()
    const b = tokenB()

    expect(a).not.toBe(b)
  })

  it('throws when env vars are missing', async () => {
    delete process.env.ACCESS_PASSWORD
    const { sessionToken } = await importAuth()
    expect(() => sessionToken()).toThrow(/ACCESS_PASSWORD and AUTH_SECRET/)
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

  it('returns true when the cookie matches the session token', async () => {
    const { isAuthenticated, sessionToken, SESSION_COOKIE } = await importAuth()
    const header = `${SESSION_COOKIE}=${sessionToken()}`
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
    const { requireAuth, sessionToken, SESSION_COOKIE } = await importAuth()
    const req = new Request('http://localhost/api/files', {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken()}` },
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
