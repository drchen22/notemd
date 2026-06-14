import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  toErrorResponse,
} from '@/lib/errors'

describe('AppError', () => {
  it('carries status, code, and message', () => {
    const err = new ForbiddenError('PATH_TRAVERSAL', 'Forbidden')
    expect(err.status).toBe(403)
    expect(err.code).toBe('PATH_TRAVERSAL')
    expect(err.message).toBe('Forbidden')
    expect(err.name).toBe('ForbiddenError')
  })

  it('is an instance of Error and AppError', () => {
    const err = new NotFoundError()
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toBeInstanceOf(NotFoundError)
  })
})

describe('Error subclasses default to their canonical status', () => {
  it('ForbiddenError → 403', () => {
    expect(new ForbiddenError().status).toBe(403)
  })
  it('NotFoundError → 404', () => {
    expect(new NotFoundError().status).toBe(404)
  })
  it('ConflictError → 409', () => {
    expect(new ConflictError().status).toBe(409)
  })
  it('ValidationError → 400', () => {
    expect(new ValidationError().status).toBe(400)
  })
})

describe('toErrorResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('maps ForbiddenError to 403 with its message', async () => {
    const res = toErrorResponse(new ForbiddenError('PATH_TRAVERSAL', 'Forbidden'), 'fallback')
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('maps NotFoundError to 404', async () => {
    const res = toErrorResponse(new NotFoundError('ITEM_NOT_FOUND', 'Item not found'), 'fallback')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Item not found')
  })

  it('maps ConflictError to 409', async () => {
    const res = toErrorResponse(new ConflictError('FILE_EXISTS', 'File already exists'), 'fallback')
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('File already exists')
  })

  it('maps ValidationError to 400', async () => {
    const res = toErrorResponse(new ValidationError('NAME_EMPTY', 'Name cannot be empty'), 'fallback')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Name cannot be empty')
  })

  it('maps unknown errors to 500 with fallback message and logs', async () => {
    const res = toErrorResponse(new Error('disk full'), 'Failed to save file')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to save file')
    expect(console.error).toHaveBeenCalled()
  })

  it('maps non-Error throws (e.g. string) to 500 fallback', async () => {
    const res = toErrorResponse('weird throw', 'fallback')
    expect(res.status).toBe(500)
    expect(console.error).toHaveBeenCalled()
  })

  it('returns a NextResponse instance', () => {
    const res = toErrorResponse(new NotFoundError(), 'fallback')
    expect(res).toBeInstanceOf(NextResponse)
  })
})
