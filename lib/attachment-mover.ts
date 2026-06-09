import fs from 'fs/promises'
import path from 'path'

import { getContentDir } from '@/lib/content-dir'
import { extractAttachmentRefs } from '@/lib/attachment-refs'

/**
 * Migrate attachments when a file is moved from one directory to another.
 *
 * Strategy: **copy** (not move) attachments to the new location so that
 * other files still in the old directory that reference the same images
 * are not broken.  The original copies become candidates for orphan cleanup.
 *
 * @param oldFilePath  Relative path before the move  (e.g. "inbox/note.md")
 * @param newFilePath  Relative path after the move   (e.g. "guides/note.md")
 * @returns Array of attachment paths that were copied
 */
export async function migrateAttachments(
  oldFilePath: string,
  newFilePath: string,
): Promise<string[]> {
  // Extract references from the file at its NEW location (content is already moved)
  const refs = await extractAttachmentRefs(newFilePath)
  if (refs.length === 0) return []

  const contentDir = getContentDir()

  const oldDir = path.dirname(path.join(contentDir, oldFilePath))
  const newDir = path.dirname(path.join(contentDir, newFilePath))

  // If the file stayed in the same directory, nothing to do
  if (oldDir === newDir) return []

  const migrated: string[] = []

  for (const ref of refs) {
    const srcAbs = path.join(oldDir, ref)
    const dstAbs = path.join(newDir, ref)

    // Skip if source doesn't exist (broken ref)
    try {
      await fs.access(srcAbs)
    } catch {
      continue
    }

    // Skip if destination already exists (UUID collision is nearly impossible, but be safe)
    try {
      await fs.access(dstAbs)
      continue
    } catch {
      // Good — destination doesn't exist
    }

    // Ensure target assets/ directory exists
    await fs.mkdir(path.dirname(dstAbs), { recursive: true })

    // Copy the file
    await fs.copyFile(srcAbs, dstAbs)
    migrated.push(ref)
  }

  return migrated
}
