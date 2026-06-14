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
import { titleToSlug, slugToTitle } from '@/lib/frontmatter'
import { requireAuth } from '@/lib/auth'

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
  const denied = requireAuth(request)
  if (denied) return denied

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
  const denied = requireAuth(request)
  if (denied) return denied
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
  const denied = requireAuth(request)
  if (denied) return denied
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

    if (action === 'rename-from-title') {
      const { path: itemPath, title } = body
      if (!itemPath || !title) {
        return NextResponse.json({ error: 'Missing path or title' }, { status: 400 })
      }
      const slug = titleToSlug(title)
      if (!slug) {
        return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
      }
      // Preserve extension
      const ext = itemPath.endsWith('.excalidraw') ? '.excalidraw' : '.md'
      const baseName = slug + ext
      // No-op if name unchanged
      const currentBasename = itemPath.split('/').pop() ?? itemPath
      if (currentBasename === baseName) {
        return NextResponse.json({ success: true, newPath: itemPath, actualTitle: title })
      }
      // Try renaming; on collision, auto-append suffix (-1, -2, …)
      let newName = baseName
      let newPath: string | undefined
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          // The editor writes the file (with its own title) right after, so
          // skip the filename→title sync inside renameItem to avoid a double write.
          newPath = await renameItem(itemPath, newName, { syncTitleToFilename: false })
          break
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : ''
          if (msg.includes('already exists')) {
            newName = `${slug}-${attempt + 1}${ext}`
            continue
          }
          throw err
        }
      }
      if (!newPath) {
        return NextResponse.json({ error: 'Could not find a unique name' }, { status: 409 })
      }
      // Derive the actual title from the final filename (may differ if suffix was added)
      const finalSlug = newName.replace(ext, '')
      const actualTitle = slugToTitle(finalSlug)
      return NextResponse.json({ success: true, newPath, actualTitle })
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
    return classifyError(err, 'Failed to delete item')
  }
}
