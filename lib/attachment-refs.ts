import fs from 'fs/promises'

import { getContentDir } from '@/lib/content-dir'

/** Regex matching markdown image references with relative asset paths */
const MD_IMAGE_REGEX = /!\[[^\]]*\]\((assets\/[^)]+)\)/g

/**
 * Extract attachment references from markdown content.
 * Returns unique relative paths like "assets/uuid.png".
 */
export function extractMdImageRefs(content: string): string[] {
  const refs = new Set<string>()
  let match: RegExpExecArray | null
  MD_IMAGE_REGEX.lastIndex = 0
  while ((match = MD_IMAGE_REGEX.exec(content)) !== null) {
    refs.add(match[1])
  }
  return Array.from(refs)
}

/**
 * Extract attachment references from .excalidraw JSON content.
 * Looks at the `fileReferences` object and returns unique relative paths.
 */
export function extractExcalidrawRefs(content: string): string[] {
  try {
    const parsed = JSON.parse(content)
    if (parsed.fileReferences && typeof parsed.fileReferences === 'object') {
      const refs = new Set<string>()
      for (const refPath of Object.values(parsed.fileReferences)) {
        if (typeof refPath === 'string' && refPath.startsWith('assets/')) {
          refs.add(refPath)
        }
      }
      return Array.from(refs)
    }
  } catch {
    // Invalid JSON — return empty
  }
  return []
}

/**
 * Read a file and extract all attachment references from it.
 * Detects file type by extension and delegates to the appropriate parser.
 * Returns relative paths like "assets/uuid.png".
 */
export async function extractAttachmentRefs(filePath: string): Promise<string[]> {
  const contentDir = getContentDir()
  const absolutePath = `${contentDir}/${filePath}`

  let content: string
  try {
    content = await fs.readFile(absolutePath, 'utf-8')
  } catch {
    return []
  }

  if (filePath.endsWith('.excalidraw')) {
    return extractExcalidrawRefs(content)
  }

  // Default: treat as markdown
  return extractMdImageRefs(content)
}
