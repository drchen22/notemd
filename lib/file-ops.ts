import fs from 'fs/promises'
import path from 'path'

import type { FileTreeNode } from '@/types/file-tree'
import type { NoteFrontmatter } from '@/types/frontmatter'
import {
  parseFrontmatter,
  stringifyFrontmatter,
  generateDefaultFrontmatter,
  isEmptyFrontmatter,
} from '@/lib/frontmatter'

const CONTENT_DIR = path.join(process.cwd(), 'content')

/** Resolve and validate a path inside the content directory */
function resolveSafePath(filePath: string) {
  const resolved = path.resolve(CONTENT_DIR, filePath)
  if (
    !resolved.startsWith(CONTENT_DIR + path.sep) &&
    resolved !== CONTENT_DIR
  ) {
    throw new Error('Forbidden: path traversal detected')
  }
  if (!resolved.endsWith('.md')) {
    throw new Error('Forbidden: only .md files are allowed')
  }
  return resolved
}

/** Resolve and validate a folder/any-item path inside the content directory (no .md restriction) */
function resolveSafePathForItem(itemPath: string) {
  const resolved = path.resolve(CONTENT_DIR, itemPath)
  if (
    !resolved.startsWith(CONTENT_DIR + path.sep) &&
    resolved !== CONTENT_DIR
  ) {
    throw new Error('Forbidden: path traversal detected')
  }
  return resolved
}

/** Validate a file/folder name (no path separators, no hidden files) */
function validateName(name: string) {
  if (!name || !name.trim()) throw new Error('Name cannot be empty')
  if (name.includes('/') || name.includes('\\')) throw new Error('Name cannot contain path separators')
  if (name.includes('..')) throw new Error('Name cannot contain ".."')
  if (name.startsWith('.')) throw new Error('Name cannot start with "."')
}

/** Result of reading a file with frontmatter parsed separately */
export interface FileReadResult {
  /** Markdown body content (no YAML frontmatter) */
  content: string
  /** Parsed frontmatter metadata */
  frontmatter: NoteFrontmatter
}

/** Recursively read directory tree */
async function readDirectory(
  dir: string,
  basePath: string
): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: FileTreeNode[] = []

  // Directories to hide from the file tree (e.g. asset/image folders)
  const HIDDEN_DIRS = new Set(['assets'])

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory() && HIDDEN_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, relativePath)
      // Show empty folders so users can see newly created ones
      nodes.push({ name: entry.name, path: relativePath, type: 'folder', children })
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Parse frontmatter for file nodes
      let frontmatter: NoteFrontmatter | undefined
      let preview: string | undefined
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
      nodes.push({ name: entry.name, path: relativePath, type: 'file', frontmatter, preview })
    }
  }

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
  const tree = await readDirectory(CONTENT_DIR, '')

  function flatten(nodes: FileTreeNode[]): { name: string; path: string; type: 'file' | 'folder' }[] {
    return nodes.flatMap((n) => [
      { name: n.name, path: n.path, type: n.type },
      ...(n.children ? flatten(n.children) : []),
    ])
  }

  return flatten(tree)
}

/** Read the directory tree (exported for API route reuse) */
export async function getTree(): Promise<FileTreeNode[]> {
  return readDirectory(CONTENT_DIR, '')
}

/** Read a markdown file's content with frontmatter parsed separately */
export async function readFile(filePath: string): Promise<FileReadResult> {
  const resolved = resolveSafePath(filePath)
  const raw = await fs.readFile(resolved, 'utf-8')
  return parseFrontmatter(raw)
}

/** Write content to a markdown file (full replacement).
 *  Optionally accepts frontmatter to prepend as YAML block. */
export async function writeFile(
  filePath: string,
  content: string,
  frontmatter?: NoteFrontmatter
): Promise<void> {
  const resolved = resolveSafePath(filePath)

  // Ensure parent directories exist
  await fs.mkdir(path.dirname(resolved), { recursive: true })

  const fullContent = frontmatter && !isEmptyFrontmatter(frontmatter)
    ? stringifyFrontmatter(frontmatter, content)
    : content

  await fs.writeFile(resolved, fullContent, 'utf-8')
}

/**
 * Incrementally edit a markdown file by replacing oldText with newText.
 * Operates on the full raw file (including frontmatter), so frontmatter is preserved.
 * Returns the number of replacements made.
 * Throws if oldText is not found or appears more than once (ambiguous).
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
    throw new Error(
      `oldText not found in ${filePath}. Use readFile first to see the current content.`
    )
  }
  if (count > 1) {
    throw new Error(
      `oldText appears ${count} times in ${filePath}. Provide more surrounding context to make it unique.`
    )
  }

  const updated = content.replace(oldText, newText)
  await fs.writeFile(resolved, updated, 'utf-8')
  return { replacements: 1 }
}

/** Create a new .md file with auto-generated frontmatter */
export async function createFile(
  filePath: string,
  content = ''
): Promise<void> {
  // Ensure .md extension
  if (!filePath.endsWith('.md')) {
    filePath += '.md'
  }
  validateName(path.basename(filePath))
  const resolved = resolveSafePath(filePath)

  // Check if already exists
  try {
    await fs.access(resolved)
    throw new Error('File already exists')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'File already exists') throw err
    // File doesn't exist — proceed
  }

  const defaultFm = generateDefaultFrontmatter(filePath)
  const fullContent = content
    ? stringifyFrontmatter(defaultFm, content)
    : stringifyFrontmatter(defaultFm, '')

  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, fullContent, 'utf-8')
}

/** Create a new directory */
export async function createFolder(folderPath: string): Promise<void> {
  validateName(path.basename(folderPath))
  const resolved = resolveSafePathForItem(folderPath)

  // Check if already exists
  try {
    await fs.access(resolved)
    throw new Error('Folder already exists')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Folder already exists') throw err
    // Doesn't exist — proceed
  }

  await fs.mkdir(resolved, { recursive: true })
}

/** Delete a file or folder (recursive) */
export async function deleteItem(itemPath: string): Promise<void> {
  const resolved = resolveSafePathForItem(itemPath)

  // Check existence
  try {
    await fs.access(resolved)
  } catch {
    throw new Error('Item not found')
  }

  await fs.rm(resolved, { recursive: true, force: true })
}

/** Rename a file or folder. Returns the new relative path. */
export async function renameItem(
  itemPath: string,
  newName: string
): Promise<string> {
  validateName(newName)

  const oldResolved = resolveSafePathForItem(itemPath)

  // Check source exists
  try {
    await fs.access(oldResolved)
  } catch {
    throw new Error('Item not found')
  }

  // Build new path at the same parent level
  const parentDir = path.dirname(oldResolved)

  // If the source is a .md file and the new name doesn't end with .md, append it
  const isFile = itemPath.endsWith('.md')
  const finalName = isFile && !newName.endsWith('.md') ? newName + '.md' : newName

  const newResolved = path.join(parentDir, finalName)

  // Check target doesn't exist
  try {
    await fs.access(newResolved)
    throw new Error('An item with this name already exists')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'An item with this name already exists') throw err
    // Doesn't exist — proceed
  }

  await fs.rename(oldResolved, newResolved)

  // Return new relative path
  return path.relative(CONTENT_DIR, newResolved)
}

/** Move a file or folder into a target directory. Returns the new relative path. */
export async function moveItem(
  sourcePath: string,
  targetDir: string
): Promise<string> {
  const sourceResolved = resolveSafePathForItem(sourcePath)
  const targetDirResolved = targetDir
    ? resolveSafePathForItem(targetDir)
    : CONTENT_DIR

  // Check source exists
  try {
    await fs.access(sourceResolved)
  } catch {
    throw new Error('Source not found')
  }

  // Check target dir exists
  try {
    const stat = await fs.stat(targetDirResolved)
    if (!stat.isDirectory()) throw new Error('Target is not a directory')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Target is not a directory') throw err
    throw new Error('Target directory not found')
  }

  // Prevent moving into self or descendant
  if (targetDirResolved.startsWith(sourceResolved + path.sep)) {
    throw new Error('Cannot move an item into its own descendant')
  }
  if (targetDirResolved === sourceResolved) {
    throw new Error('Cannot move an item into itself')
  }

  const itemName = path.basename(sourceResolved)
  const newResolved = path.join(targetDirResolved, itemName)

  // Check target doesn't exist
  try {
    await fs.access(newResolved)
    throw new Error('An item with this name already exists in the target folder')
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'An item with this name already exists in the target folder') throw err
    // Doesn't exist — proceed
  }

  await fs.rename(sourceResolved, newResolved)

  return path.relative(CONTENT_DIR, newResolved)
}
