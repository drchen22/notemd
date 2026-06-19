import fs from 'fs/promises'
import path from 'path'

import { getContentDir } from '@/lib/content-dir'

/** Supported image extensions in assets/ */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

export interface CategoryStats {
  count: number
  size: number
}

export interface FolderBreakdown {
  markdown: number
  images: number
}

export interface FolderStats {
  name: string
  path: string
  size: number
  fileCount: number
  breakdown: FolderBreakdown
}

export interface StorageAnalysis {
  totalSize: number
  categories: {
    markdown: CategoryStats
    images: CategoryStats
  }
  folders: FolderStats[]
}

/**
 * Scan the content directory and return space usage broken down by
 * category (markdown / images) and by top-level folder.
 */
export async function analyzeStorage(): Promise<StorageAnalysis> {
  const contentDir = getContentDir()

  const categories = {
    markdown: { count: 0, size: 0 } as CategoryStats,
    images: { count: 0, size: 0 } as CategoryStats,
  }

  // Map: top-level relative folder path → accumulated stats
  const folderMap = new Map<string, FolderStats>()

  // Collect all files first, then stat in parallel
  const fileEntries: Array<{
    absPath: string
    relPath: string
    topFolder: string
    category: 'markdown' | 'images'
  }> = []

  async function walk(dir: string, relDir: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      const fullPath = path.join(dir, entry.name)
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        await walk(fullPath, relPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        let category: 'markdown' | 'images' | null = null

        if (ext === '.md') {
          category = 'markdown'
        } else if (IMAGE_EXTENSIONS.has(ext) && relPath.includes('/assets/')) {
          category = 'images'
        }

        if (!category) return

        // Top-level folder: first segment of relPath, or "/" for root files
        const topFolder = relDir ? relDir.split('/')[0] : '/'

        fileEntries.push({ absPath: fullPath, relPath, topFolder, category })
      }
    }
  }

  await walk(contentDir, '')

  // Stat all files in parallel
  const statResults = await Promise.allSettled(
    fileEntries.map(async (entry) => {
      const stat = await fs.stat(entry.absPath)
      return { ...entry, size: stat.size }
    }),
  )

  // Aggregate
  let totalSize = 0

  for (const result of statResults) {
    if (result.status !== 'fulfilled') continue
    const { topFolder, category, size } = result.value

    totalSize += size
    categories[category].count += 1
    categories[category].size += size

    if (!folderMap.has(topFolder)) {
      folderMap.set(topFolder, {
        name: topFolder === '/' ? '(根目录)' : topFolder,
        path: topFolder === '/' ? '' : topFolder,
        size: 0,
        fileCount: 0,
        breakdown: { markdown: 0, images: 0 },
      })
    }

    const folder = folderMap.get(topFolder)!
    folder.size += size
    folder.fileCount += 1
    folder.breakdown[category] += size
  }

  // Sort folders by size descending
  const folders = Array.from(folderMap.values()).sort((a, b) => b.size - a.size)

  return { totalSize, categories, folders }
}
