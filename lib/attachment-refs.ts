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
 * Read a markdown file and extract all attachment references from it.
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

  return extractMdImageRefs(content)
}
