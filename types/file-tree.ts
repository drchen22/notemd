import type { NoteFrontmatter } from './frontmatter'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  /** Parsed frontmatter metadata (only present for files) */
  frontmatter?: NoteFrontmatter
  /** First few lines of content as preview (only present for files) */
  preview?: string
}
