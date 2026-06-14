import { NextResponse } from 'next/server'

import {
  findOrphanAttachments,
  deleteOrphanAttachments,
} from '@/lib/orphan-detector'
import { analyzeStorage } from '@/lib/storage-analyzer'
import { requireAuth } from '@/lib/auth'

/** GET /api/attachments?action=orphans — list orphaned attachments */
export async function GET(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'orphans') {
    try {
      const orphans = await findOrphanAttachments()
      const totalSize = orphans.reduce((sum, o) => sum + o.size, 0)
      return NextResponse.json({ orphans, totalSize })
    } catch {
      return NextResponse.json(
        { error: 'Failed to scan for orphaned attachments' },
        { status: 500 },
      )
    }
  }

  if (action === 'storage') {
    try {
      const analysis = await analyzeStorage()
      return NextResponse.json(analysis)
    } catch {
      return NextResponse.json(
        { error: 'Failed to analyze storage' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

/** DELETE /api/attachments — delete selected orphan attachments */
export async function DELETE(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const { paths }: { paths?: string[] } = body

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty paths array' },
        { status: 400 },
      )
    }

    const result = await deleteOrphanAttachments(paths)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete orphaned attachments' },
      { status: 500 },
    )
  }
}
