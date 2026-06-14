import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAuthenticated } from '@/lib/auth'

/**
 * Central auth gate (optimistic cookie check, runs before route handlers).
 *
 * - /api/auth/*        → always public (login/logout)
 * - /api/* (the rest)  → 401 JSON when unauthenticated (NOT a redirect, so
 *                        client fetch() can detect expired sessions cleanly)
 * - /login             → public; authenticated users bounce to /
 * - pages (/, …)       → redirect to /login when unauthenticated
 *
 * NOTE: this is the optimistic layer. Route handlers also call requireAuth()
 * (defense in depth) so a matcher change can never silently expose the API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Auth endpoints are always reachable.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Never rewrite static assets.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const authenticated = isAuthenticated(request.headers.get('cookie'))

  // API routes get a JSON 401 (not a redirect) so client fetch() can detect it.
  if (pathname.startsWith('/api/')) {
    return authenticated
      ? NextResponse.next()
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Authenticated users on /login go straight to the editor.
  if (pathname === '/login') {
    return authenticated
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next()
  }

  // Protect pages — redirect to login when unauthenticated.
  return authenticated
    ? NextResponse.next()
    : NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // Run on pages and API routes; skip Next internals and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
