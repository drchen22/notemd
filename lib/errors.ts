import { NextResponse } from 'next/server'

/**
 * Base class for all predictable application errors.
 *
 * Carries an HTTP `status`, a stable machine-readable `code`, and a
 * user-visible `message`. The `message` text is kept stable so existing
 * tests and clients that match on substrings (e.g. /already exists/) keep
 * working — classification is driven by the subclass type / `code`, not by
 * sniffing the message string.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
  }
}

/** 403 — path traversal, disallowed extension, forbidden access. */
export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Forbidden') {
    super(403, code, message)
  }
}

/** 404 — item/file/source/target not found. */
export class NotFoundError extends AppError {
  constructor(code = 'NOT_FOUND', message = 'Not found') {
    super(404, code, message)
  }
}

/** 409 — name collision, move into descendant/self. */
export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Conflict') {
    super(409, code, message)
  }
}

/** 400 — invalid input (bad name, bad body). */
export class ValidationError extends AppError {
  constructor(code = 'VALIDATION', message = 'Invalid input') {
    super(400, code, message)
  }
}

/**
 * Convert a thrown value into a JSON error response.
 *
 * - `AppError` subclasses use their embedded status + message.
 * - Anything else maps to 500 with `fallbackMessage` (and is logged server-side).
 *
 * Replaces the old `classifyError()` string-matching approach.
 */
export function toErrorResponse(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error('[toErrorResponse] unhandled error:', err)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
