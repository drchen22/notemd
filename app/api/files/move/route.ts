import { NextResponse } from 'next/server'

import { moveItem } from '@/lib/file-ops'
import { requireAuth } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'

/**
 * Move a file or folder into a target directory. Body shape kept compatible
 * with the old PATCH /api/files?action=move so clients only change the URL.
 *
 *   POST /api/files/move { action: 'move', sourcePath, targetDir }
 */
export async function POST(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const { sourcePath, targetDir } = body
    if (!sourcePath || targetDir == null) {
      return NextResponse.json({ error: 'Missing sourcePath or targetDir' }, { status: 400 })
    }
    const newPath = await moveItem(sourcePath, targetDir)
    return NextResponse.json({ success: true, newPath })
  } catch (err: unknown) {
    return toErrorResponse(err, 'Failed to move item')
  }
}
