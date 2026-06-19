import fs from 'fs/promises'
import path from 'path'

import { getContentDir } from '@/lib/content-dir'
import { extractMdImageRefs } from '@/lib/attachment-refs'

/** An attachment file that is not referenced by any document */
export interface OrphanAttachment {
  /** Relative path from content dir (e.g. "inbox/assets/uuid.png") */
  path: string
  /** File size in bytes */
  size: number
  /** ISO 8601 last modified date */
  lastModified: string
}

/** Result of deleting orphan attachments */
export interface DeleteOrphanResult {
  /** Successfully deleted relative paths */
  deleted: string[]
  /** Paths that failed to delete */
  failed: Array<{ path: string; error: string }>
}

/** Supported image extensions in assets/ */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

/**
 * Recursively collect all files in every `assets/` directory under content/.
 * Returns a map: relative-dir-path → Set<filename>
 */
async function collectAllAttachments(contentDir: string): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()

  async function walk(dir: string, relDir: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.name === 'assets' && entry.isDirectory()) {
        const assetsDir = path.join(dir, entry.name)
        const relAssetsDir = relDir ? `${relDir}/assets` : 'assets'
        const files = new Set<string>()

        try {
          const assets = await fs.readdir(assetsDir)
          for (const f of assets) {
            const ext = path.extname(f).toLowerCase()
            if (IMAGE_EXTENSIONS.has(ext)) {
              files.add(f)
            }
          }
        } catch {
          // assets dir might be unreadable
        }

        if (files.size > 0) {
          result.set(relAssetsDir, files)
        }
      } else if (entry.isDirectory()) {
        const childRel = relDir ? `${relDir}/${entry.name}` : entry.name
        await walk(path.join(dir, entry.name), childRel)
      }
    }
  }

  await walk(contentDir, '')
  return result
}

/**
 * Recursively find all .md files and collect the attachment refs they contain.
 * Returns a map: relative-assets-dir → Set<filename>
 */
async function collectReferencedAttachments(contentDir: string): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()

  async function walk(dir: string, relDir: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'assets' && entry.isDirectory()) continue

      const fullPath = path.join(dir, entry.name)
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        await walk(fullPath, relPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ext !== '.md') continue

        let refs: string[] = []
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          refs = extractMdImageRefs(content)
        } catch {
          continue
        }

        for (const ref of refs) {
          // ref is like "assets/uuid.png"
          const refDir = relDir || ''
          const assetsKey = refDir ? `${refDir}/assets` : 'assets'
          const filename = path.basename(ref)

          let set = result.get(assetsKey)
          if (!set) {
            set = new Set()
            result.set(assetsKey, set)
          }
          set.add(filename)
        }
      }
    }
  }

  await walk(contentDir, '')
  return result
}

/**
 * Scan the content directory for orphaned attachments — image files in
 * `assets/` directories that are not referenced by any .md file.
 */
export async function findOrphanAttachments(): Promise<OrphanAttachment[]> {
  const contentDir = getContentDir()

  const [allAttachments, referencedAttachments] = await Promise.all([
    collectAllAttachments(contentDir),
    collectReferencedAttachments(contentDir),
  ])

  // Collect all candidate orphan paths first, then stat them in parallel
  const candidates: Array<{ absPath: string; relPath: string }> = []

  for (const [relAssetsDir, files] of allAttachments) {
    const referenced = referencedAttachments.get(relAssetsDir) ?? new Set<string>()

    for (const filename of files) {
      if (referenced.has(filename)) continue

      const absPath = path.join(contentDir, relAssetsDir, filename)
      const relPath = path.relative(contentDir, absPath)
      candidates.push({ absPath, relPath })
    }
  }

  const statResults = await Promise.allSettled(
    candidates.map(async ({ absPath, relPath }) => {
      const stat = await fs.stat(absPath)
      return { path: relPath, size: stat.size, lastModified: stat.mtime.toISOString() }
    }),
  )

  const orphans: OrphanAttachment[] = statResults
    .filter((r): r is PromiseFulfilledResult<OrphanAttachment> => r.status === 'fulfilled')
    .map((r) => r.value)

  // Sort by path for consistent output
  orphans.sort((a, b) => a.path.localeCompare(b.path))
  return orphans
}

/**
 * Delete the specified orphan attachments by their relative paths.
 */
export async function deleteOrphanAttachments(
  paths: string[],
): Promise<DeleteOrphanResult> {
  const contentDir = getContentDir()
  const deleted: string[] = []
  const failed: Array<{ path: string; error: string }> = []

  await Promise.all(
    paths.map(async (relPath) => {
      try {
        const absPath = path.resolve(contentDir, relPath)
        // Safety check: must be inside content dir and in an assets/ folder
        if (
          !absPath.startsWith(contentDir + path.sep) ||
          !absPath.includes(`${path.sep}assets${path.sep}`)
        ) {
          throw new Error('Invalid path')
        }
        await fs.unlink(absPath)
        deleted.push(relPath)
      } catch (err) {
        failed.push({
          path: relPath,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }),
  )

  return { deleted, failed }
}
