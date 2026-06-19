import { NextResponse } from 'next/server'

import {
  getTree,
  readFile,
  writeFile,
  createFile,
  createFolder,
  deleteItem,
} from '@/lib/file-ops'
import { requireAuth } from '@/lib/auth'
import { toErrorResponse } from '@/lib/errors'

export async function GET(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'tree') {
    try {
      const tree = await getTree()
      return NextResponse.json({ tree })
    } catch (err) {
      console.error('[files] read tree:', err)
      return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 })
    }
  }

  if (action === 'read') {
    const filePath = searchParams.get('path')
    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    try {
      const { content, frontmatter } = await readFile(filePath)
      return NextResponse.json({ content, frontmatter, path: filePath })
    } catch (err: unknown) {
      return toErrorResponse(err, 'File not found')
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function PUT(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const { path: filePath, content, frontmatter } = body

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    // If frontmatter is not provided by the client, preserve existing frontmatter
    if (frontmatter === undefined) {
      try {
        const existing = await readFile(filePath)
        await writeFile(filePath, content, existing.frontmatter)
      } catch {
        // File may not exist yet — write without frontmatter
        await writeFile(filePath, content)
      }
    } else {
      await writeFile(filePath, content, frontmatter)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return toErrorResponse(err, 'Failed to save file')
  }
}

export async function POST(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const { action, path: itemPath, content } = body

    if (!action || !itemPath) {
      return NextResponse.json({ error: 'Missing action or path' }, { status: 400 })
    }

    if (action === 'create-file') {
      // createFile auto-generates frontmatter internally
      await createFile(itemPath, content ?? '')
      return NextResponse.json({ success: true, path: itemPath }, { status: 201 })
    }

    if (action === 'create-folder') {
      await createFolder(itemPath)
      return NextResponse.json({ success: true, path: itemPath }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return toErrorResponse(err, 'Failed to create item')
  }
}

export async function DELETE(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  try {
    const body = await request.json()
    const { path: itemPath } = body

    if (!itemPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    await deleteItem(itemPath)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return toErrorResponse(err, 'Failed to delete item')
  }
}
