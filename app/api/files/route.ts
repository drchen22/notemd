import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

import type { FileTreeNode } from '@/types/file-tree'

const CONTENT_DIR = path.join(process.cwd(), 'content')

async function readDirectory(dir: string, basePath: string): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: FileTreeNode[] = []

  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, relativePath)
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'folder',
          children,
        })
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      })
    }
  }

  // Sort: folders first, then files, both alphabetical
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'tree') {
    try {
      const tree = await readDirectory(CONTENT_DIR, '')
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

    // Prevent path traversal
    const resolvedPath = path.resolve(CONTENT_DIR, filePath)
    if (!resolvedPath.startsWith(CONTENT_DIR + path.sep) && resolvedPath !== CONTENT_DIR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow .md files
    if (!resolvedPath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files are allowed' }, { status: 403 })
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8')
      return NextResponse.json({ content, path: filePath })
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { path: filePath, content } = body

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    // Prevent path traversal
    const resolvedPath = path.resolve(CONTENT_DIR, filePath)
    if (!resolvedPath.startsWith(CONTENT_DIR + path.sep) && resolvedPath !== CONTENT_DIR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow .md files
    if (!resolvedPath.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files are allowed' }, { status: 403 })
    }

    await fs.writeFile(resolvedPath, content, 'utf-8')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }
}
