import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

import { getContentDir } from '@/lib/content-dir'
import { requireAuth } from '@/lib/auth'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // Prevent path traversal
  const contentDir = getContentDir()
  const resolvedPath = path.resolve(contentDir, filePath)
  if (!resolvedPath.startsWith(contentDir + path.sep) && resolvedPath !== contentDir) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow image file extensions
  const ext = path.extname(resolvedPath).toLowerCase()
  const contentType = MIME_TYPES[ext]
  if (!contentType) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 403 })
  }

  try {
    const buffer = await fs.readFile(resolvedPath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[content-files] read:', err)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
