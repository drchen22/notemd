import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

import { getContentDir } from '@/lib/content-dir'
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const filePath = formData.get('filePath') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Only allow image types
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Determine target directory: content/{fileDir}/assets/
    const fileDir = filePath ? path.dirname(filePath) : ''
    const assetsDir = path.join(getContentDir(), fileDir, 'assets')
    await fs.mkdir(assetsDir, { recursive: true })

    // Generate unique filename preserving extension
    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const filename = `${randomUUID()}${ext}`
    const fullPath = path.join(assetsDir, filename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(fullPath, buffer)

    // Return relative path (relative to the markdown file)
    return NextResponse.json({ path: `assets/${filename}` })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
