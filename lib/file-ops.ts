import fs from 'fs/promises'
import path from 'path'

import type { FileTreeNode } from '@/types/file-tree'
import type { NoteFrontmatter } from '@/types/frontmatter'
import {
  parseFrontmatter,
  stringifyFrontmatter,
  generateDefaultFrontmatter,
  isEmptyFrontmatter,
  slugToTitle,
} from '@/lib/frontmatter'

import { getContentDir } from '@/lib/content-dir'
import { migrateAttachments } from '@/lib/attachment-mover'
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from '@/lib/errors'

const ALLOWED_EXTENSIONS = ['.md', '.excalidraw']

/** Check if a file path has a supported extension */
function isAllowedFile(filePath: string): boolean {
  return ALLOWED_EXTENSIONS.some((ext) => filePath.endsWith(ext))
}

/** Resolve and validate a path inside the content directory */
function resolveSafePath(filePath: string) {
  const contentDir = getContentDir()
  const resolved = path.resolve(contentDir, filePath)
  if (
    !resolved.startsWith(contentDir + path.sep) &&
    resolved !== contentDir
  ) {
    throw new ForbiddenError('PATH_TRAVERSAL', 'Forbidden: path traversal detected')
  }
  if (!isAllowedFile(resolved)) {
    throw new ForbiddenError('INVALID_EXTENSION', 'Forbidden: only .md and .excalidraw files are allowed')
  }
  return resolved
}

/** Resolve and validate a folder/any-item path inside the content directory (no .md restriction) */
function resolveSafePathForItem(itemPath: string) {
  const contentDir = getContentDir()
  const resolved = path.resolve(contentDir, itemPath)
  if (
    !resolved.startsWith(contentDir + path.sep) &&
    resolved !== contentDir
  ) {
    throw new ForbiddenError('PATH_TRAVERSAL', 'Forbidden: path traversal detected')
  }
  return resolved
}

/** Validate a file/folder name (no path separators, no hidden files) */
function validateName(name: string) {
  if (!name || !name.trim()) throw new ValidationError('NAME_EMPTY', 'Name cannot be empty')
  if (name.includes('/') || name.includes('\\')) throw new ValidationError('NAME_SEPARATORS', 'Name cannot contain path separators')
  if (name.includes('..')) throw new ValidationError('NAME_DOTDOT', 'Name cannot contain ".."')
  if (name.startsWith('.')) throw new ValidationError('NAME_HIDDEN', 'Name cannot start with "."')
}

/** Result of reading a file with frontmatter parsed separately */
export interface FileReadResult {
  /** Markdown body content (no YAML frontmatter) */
  content: string
  /** Parsed frontmatter metadata */
  frontmatter: NoteFrontmatter
}

/** Recursively read directory tree. I/O within each directory is parallelized. */
async function readDirectory(
  dir: string,
  basePath: string
): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  // Directories to hide from the file tree (e.g. asset/image folders)
  const HIDDEN_DIRS = new Set(['assets'])

  // Build each entry's node concurrently — subdirectories recurse in parallel,
  // .md files are read + parsed in parallel.
  const nodePromises = entries.map(async (entry): Promise<FileTreeNode | null> => {
    if (entry.name.startsWith('.')) return null
    if (entry.isDirectory() && HIDDEN_DIRS.has(entry.name)) return null

    const fullPath = path.join(dir, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, relativePath)
      // Show empty folders so users can see newly created ones
      return { name: entry.name, path: relativePath, type: 'folder', children }
    }
    if (entry.isFile() && isAllowedFile(entry.name)) {
      // Parse frontmatter for .md file nodes
      let frontmatter: NoteFrontmatter | undefined
      let preview: string | undefined
      if (entry.name.endsWith('.md')) {
        try {
          const raw = await fs.readFile(fullPath, 'utf-8')
          const parsed = parseFrontmatter(raw)
          frontmatter = parsed.frontmatter
          if (isEmptyFrontmatter(frontmatter)) frontmatter = undefined
          // Extract preview: first ~200 chars of body, stripped of markdown symbols
          const body = parsed.content.replace(/^#+\s.*$/gm, '').trim()
          if (body) {
            preview = body.slice(0, 200).replace(/\n{2,}/g, ' ').replace(/\n/g, ' ').trim()
          }
        } catch {
          // Skip frontmatter on read error — still include the node
        }
      }
      return { name: entry.name, path: relativePath, type: 'file', frontmatter, preview }
    }
    return null
  })

  const nodes = (await Promise.all(nodePromises)).filter(
    (n): n is FileTreeNode => n !== null,
  )

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

/** List all files in a flat array with relative paths */
export async function listFiles(): Promise<
  { name: string; path: string; type: 'file' | 'folder' }[]
> {
  const tree = await readDirectory(getContentDir(), '')

  function flatten(nodes: FileTreeNode[]): { name: string; path: string; type: 'file' | 'folder' }[] {
    return nodes.flatMap((n) => [
      { name: n.name, path: n.path, type: n.type },
      ...(n.children ? flatten(n.children) : []),
    ])
  }

  return flatten(tree)
}

// Module-level tree cache. Reading the full vault (every .md parsed for a
// preview) is expensive; mutations invalidate it so the next read is fresh.
let treeCache: FileTreeNode[] | null = null

/** Invalidate the cached tree — call after any filesystem mutation. */
function invalidateTreeCache() {
  treeCache = null
}

/** Read the directory tree (exported for API route reuse). Cached between mutations. */
export async function getTree(): Promise<FileTreeNode[]> {
  if (treeCache) return treeCache
  treeCache = await readDirectory(getContentDir(), '')
  return treeCache
}

/** Read a file's content.
 *  For .md files, frontmatter is parsed separately.
 *  For .excalidraw files, raw JSON content is returned directly. */
export async function readFile(filePath: string): Promise<FileReadResult> {
  const resolved = resolveSafePath(filePath)
  const raw = await fs.readFile(resolved, 'utf-8')
  if (filePath.endsWith('.excalidraw')) {
    return { content: raw, frontmatter: {} }
  }
  return parseFrontmatter(raw)
}

/** Write content to a file (full replacement).
 *  For .md files, optionally accepts frontmatter to prepend as YAML block.
 *  For .excalidraw files, raw content is written directly. */
export async function writeFile(
  filePath: string,
  content: string,
  frontmatter?: NoteFrontmatter
): Promise<void> {
  const resolved = resolveSafePath(filePath)

  // Ensure parent directories exist
  await fs.mkdir(path.dirname(resolved), { recursive: true })

  const fullContent =
    filePath.endsWith('.excalidraw')
      ? content
      : frontmatter && !isEmptyFrontmatter(frontmatter)
        ? stringifyFrontmatter(frontmatter, content)
        : content

  await fs.writeFile(resolved, fullContent, 'utf-8')
  invalidateTreeCache()
}

/**
 * Incrementally edit a markdown file by replacing oldText with newText.
 * Operates on the full raw file (including frontmatter), so frontmatter is preserved.
 * Returns the number of replacements made.
 * Throws if oldText is not found or appears more than once (ambiguous).
 *
 * NOTE: This is a read-modify-write sequence with no lock — two concurrent
 * edits to the same file can lose one update. Acceptable for a single-user
 * local editor (the only caller is the AI tool loop, which is sequential);
 * adding a file lock would be over-engineering here.
 */
export async function editFile(
  filePath: string,
  oldText: string,
  newText: string
): Promise<{ replacements: number }> {
  const resolved = resolveSafePath(filePath)
  const content = await fs.readFile(resolved, 'utf-8')

  const count = content.split(oldText).length - 1
  if (count === 0) {
    throw new NotFoundError(
      'OLDTEXT_NOT_FOUND',
      `oldText not found in ${filePath}. Use readFile first to see the current content.`,
    )
  }
  if (count > 1) {
    throw new ValidationError(
      'OLDTEXT_AMBIGUOUS',
      `oldText appears ${count} times in ${filePath}. Provide more surrounding context to make it unique.`,
    )
  }

  const updated = content.replace(oldText, newText)
  await fs.writeFile(resolved, updated, 'utf-8')
  invalidateTreeCache()
  return { replacements: 1 }
}

/** Create a new file with auto-generated frontmatter (for .md) or empty scene (for .excalidraw) */
export async function createFile(
  filePath: string,
  content = ''
): Promise<void> {
  const isExcalidraw = filePath.endsWith('.excalidraw')
  // Ensure extension is present
  if (!isAllowedFile(filePath)) {
    filePath += '.md'
  }
  validateName(path.basename(filePath))
  const resolved = resolveSafePath(filePath)

  const fullContent = isExcalidraw
    ? (content || '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{"gridSize":null}}')
    : (() => {
        const defaultFm = generateDefaultFrontmatter(filePath)
        return content
          ? stringifyFrontmatter(defaultFm, content)
          : stringifyFrontmatter(defaultFm, '')
      })()

  await fs.mkdir(path.dirname(resolved), { recursive: true })
  // Atomic create: 'wx' fails with EEXIST if the file already exists,
  // closing the access-then-write TOCTOU race.
  try {
    await fs.writeFile(resolved, fullContent, { encoding: 'utf-8', flag: 'wx' })
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new ConflictError('FILE_EXISTS', 'File already exists')
    }
    throw err
  }
  invalidateTreeCache()
}

/** Create a new directory.
 *  NOTE: uses recursive:true to support nested paths (sidebar creates folders
 *  at arbitrary depth). The pre-existence check has a small TOCTOU window,
 *  acceptable for a single-user local editor; a race here at worst makes the
 *  "already exists" guard miss, not corrupt data. */
export async function createFolder(folderPath: string): Promise<void> {
  validateName(path.basename(folderPath))
  const resolved = resolveSafePathForItem(folderPath)

  // Check if already exists
  try {
    await fs.access(resolved)
    throw new ConflictError('FOLDER_EXISTS', 'Folder already exists')
  } catch (err: unknown) {
    if (err instanceof ConflictError) throw err
    // Doesn't exist — proceed
  }

  await fs.mkdir(resolved, { recursive: true })
  invalidateTreeCache()
}

/** Delete a file or folder (recursive). No access-then-rm TOCTOU window. */
export async function deleteItem(itemPath: string): Promise<void> {
  const resolved = resolveSafePathForItem(itemPath)

  // rm with force:false so a missing item surfaces as ENOENT (not silently ignored).
  try {
    await fs.rm(resolved, { recursive: true, force: false })
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('ITEM_NOT_FOUND', 'Item not found')
    }
    throw err
  }
  invalidateTreeCache()
}

/** Rename a file or folder. Returns the new relative path.
 *  The target-existence check is a functional guard (POSIX rename overwrites
 *  files), kept as an explicit check. Source-existence is detected via the
 *  rename's own ENOENT rather than a separate access preflight. */
export async function renameItem(
  itemPath: string,
  newName: string,
  opts: { syncTitleToFilename?: boolean } = {},
): Promise<string> {
  const { syncTitleToFilename = true } = opts
  validateName(newName)

  const oldResolved = resolveSafePathForItem(itemPath)

  // Build new path at the same parent level
  const parentDir = path.dirname(oldResolved)

  // If the source is a known file type and the new name doesn't have the extension, append it
  const isFile = isAllowedFile(itemPath)
  const ext = path.extname(itemPath)
  const finalName = isFile && ext && !newName.endsWith(ext) ? newName + ext : newName

  const newResolved = path.join(parentDir, finalName)

  // Check target doesn't exist (functional guard: rename would overwrite a file)
  try {
    await fs.access(newResolved)
    throw new ConflictError('TARGET_EXISTS', 'An item with this name already exists')
  } catch (err: unknown) {
    if (err instanceof ConflictError) throw err
    // Doesn't exist — proceed
  }

  // rename — ENOENT here means the source vanished between call and now.
  try {
    await fs.rename(oldResolved, newResolved)
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('ITEM_NOT_FOUND', 'Item not found')
    }
    throw err
  }

  // For .md files, sync the frontmatter title with the new filename.
  // Skipped for title-driven renames (rename-from-title), where the editor
  // owns the title and writes the file itself right after.
  if (syncTitleToFilename && finalName.endsWith('.md')) {
    try {
      const raw = await fs.readFile(newResolved, 'utf-8')
      const parsed = parseFrontmatter(raw)
      const basename = finalName.replace(/\.md$/, '')
      parsed.frontmatter.title = slugToTitle(basename)
      const updated = stringifyFrontmatter(parsed.frontmatter, parsed.content)
      await fs.writeFile(newResolved, updated, 'utf-8')
    } catch {
      // Non-critical — title sync failure should not break the rename
    }
  }

  // Return new relative path
  invalidateTreeCache()
  return path.relative(getContentDir(), newResolved)
}

/** Move a file or folder into a target directory. Returns the new relative path.
 *  Source-existence is detected via the rename's own ENOENT; target-dir and
 *  target-path existence are functional guards (must be a dir, must not exist). */
export async function moveItem(
  sourcePath: string,
  targetDir: string
): Promise<string> {
  const contentDir = getContentDir()
  const sourceResolved = resolveSafePathForItem(sourcePath)
  const targetDirResolved = targetDir
    ? resolveSafePathForItem(targetDir)
    : contentDir

  // Check target dir exists and is a directory (functional guard)
  try {
    const stat = await fs.stat(targetDirResolved)
    if (!stat.isDirectory()) throw new ValidationError('TARGET_NOT_DIR', 'Target is not a directory')
  } catch (err: unknown) {
    if (err instanceof ValidationError) throw err
    throw new NotFoundError('TARGET_NOT_FOUND', 'Target directory not found')
  }

  // Prevent moving into self or descendant
  if (targetDirResolved.startsWith(sourceResolved + path.sep)) {
    throw new ConflictError('MOVE_INTO_DESCENDANT', 'Cannot move an item into its own descendant')
  }
  if (targetDirResolved === sourceResolved) {
    throw new ConflictError('MOVE_INTO_SELF', 'Cannot move an item into itself')
  }

  const itemName = path.basename(sourceResolved)
  const newResolved = path.join(targetDirResolved, itemName)

  // Check target path doesn't exist (functional guard: rename would overwrite)
  try {
    await fs.access(newResolved)
    throw new ConflictError('TARGET_EXISTS', 'An item with this name already exists in the target folder')
  } catch (err: unknown) {
    if (err instanceof ConflictError) throw err
    // Doesn't exist — proceed
  }

  // rename — ENOENT means the source vanished between call and now.
  try {
    await fs.rename(sourceResolved, newResolved)
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('SOURCE_NOT_FOUND', 'Source not found')
    }
    throw err
  }

  const newPath = path.relative(contentDir, newResolved)
  invalidateTreeCache()

  // Migrate attachments for file moves (folder moves already carry assets/ via fs.rename)
  try {
    const stat = await fs.stat(newResolved)
    if (stat.isFile()) {
      await migrateAttachments(sourcePath, newPath)
    }
  } catch {
    // Non-critical — attachment migration failure should not break the move
  }

  return newPath
}
