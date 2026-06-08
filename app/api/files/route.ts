import { NextResponse } from 'next/server'

import {
  getTree,
  readFile,
  writeFile,
  createFile,
  createFolder,
  deleteItem,
  renameItem,
  moveItem,
} from '@/lib/file-ops'

/** Classify an error and return an appropriate JSON error response */
function classifyError(err: unknown, fallbackMessage: string) {
  const msg = err instanceof Error ? err.message : 'Unknown error'
  if (msg.includes('Forbidden')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (msg.includes('not found')) {
    return NextResponse.json({ error: msg }, { status: 404 })
  }
  if (msg.includes('already exists') || msg.includes('descendant') || msg.includes('itself')) {
    return NextResponse.json({ error: msg }, { status: 409 })
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'tree') {
    try {
      const tree = await getTree()
      return NextResponse.json({ tree })
    } catch {
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
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { path: filePath, content, frontmatter } = body

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    // If frontmatter is not provided by the client, preserve existing frontmatter
    // For .excalidraw files, just write raw content directly
    if (filePath.endsWith('.excalidraw')) {
      await writeFile(filePath, content)
    } else if (frontmatter === undefined) {
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
    return classifyError(err, 'Failed to save file')
  }
}

export async function POST(request: Request) {
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
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'rename') {
      const { path: itemPath, newName } = body
      if (!itemPath || !newName) {
        return NextResponse.json({ error: 'Missing path or newName' }, { status: 400 })
      }
      const newPath = await renameItem(itemPath, newName)
      return NextResponse.json({ success: true, newPath })
    }

    if (action === 'move') {
      const { sourcePath, targetDir } = body
      if (!sourcePath || targetDir == null) {
        return NextResponse.json({ error: 'Missing sourcePath or targetDir' }, { status: 400 })
      }
      const newPath = await moveItem(sourcePath, targetDir)
      return NextResponse.json({ success: true, newPath })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return classifyError(err, 'Failed to update item')
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { path: itemPath } = body

    if (!itemPath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    await deleteItem(itemPath)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return classifyError(err, 'Failed to delete item')
  }
}
