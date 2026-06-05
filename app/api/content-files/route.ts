import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CONTENT_DIR = path.join(process.cwd(), 'content')

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  // Prevent path traversal
  const resolvedPath = path.resolve(CONTENT_DIR, filePath)
  if (!resolvedPath.startsWith(CONTENT_DIR + path.sep) && resolvedPath !== CONTENT_DIR) {
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
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
