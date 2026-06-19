import { NextResponse } from 'next/server'

import { renameItem } from '@/lib/file-ops'
import { titleToSlug, slugToTitle } from '@/lib/frontmatter'
import { requireAuth } from '@/lib/auth'
import { toErrorResponse, ConflictError } from '@/lib/errors'

/**
 * Rename a file or folder. Body shape kept compatible with the old PATCH
 * /api/files?action=rename|rename-from-title so clients only change the URL.
 *
 *   POST /api/files/rename { action: 'rename', path, newName }
 *   POST /api/files/rename { action: 'rename-from-title', path, title }
 */
export async function POST(request: Request) {
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
      const ext = '.md'
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
          if (err instanceof ConflictError) {
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return toErrorResponse(err, 'Failed to rename item')
  }
}
