import fs from 'fs/promises'
import path from 'path'

import type { FileTreeNode } from '@/types/file-tree'

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

/** Recursively read directory tree */
async function readDirectory(
  dir: string,
  basePath: string
): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: FileTreeNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, relativePath)
      if (children.length > 0) {
        nodes.push({ name: entry.name, path: relativePath, type: 'folder', children })
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      nodes.push({ name: entry.name, path: relativePath, type: 'file' })
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

/** Read a markdown file's content */
export async function readFile(filePath: string): Promise<string> {
  const resolved = resolveSafePath(filePath)
  return fs.readFile(resolved, 'utf-8')
}

/** Write content to a markdown file (full replacement) */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  const resolved = resolveSafePath(filePath)

  // Ensure parent directories exist
  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, content, 'utf-8')
}

/**
 * Incrementally edit a markdown file by replacing oldText with newText.
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
