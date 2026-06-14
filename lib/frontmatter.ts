import matter from 'gray-matter'

import type { NoteFrontmatter } from '@/types/frontmatter'

/**
 * Parse YAML frontmatter from raw markdown content.
 * Returns body-only content and structured frontmatter object.
 * Files without frontmatter return empty object — fully backward compatible.
 */
export function parseFrontmatter(raw: string): {
  frontmatter: NoteFrontmatter
  content: string
} {
  try {
    const result = matter(raw)
    return {
      frontmatter: result.data as NoteFrontmatter,
      content: result.content,
    }
  } catch {
    // Malformed YAML — treat as no frontmatter
    console.warn('Failed to parse frontmatter, treating as plain markdown')
    return { frontmatter: {}, content: raw }
  }
}

/**
 * Serialize frontmatter + body into a complete .md file string.
 * If frontmatter is empty, returns content as-is (no YAML block).
 */
export function stringifyFrontmatter(
  frontmatter: NoteFrontmatter,
  content: string
): string {
  if (isEmptyFrontmatter(frontmatter)) return content
  return matter.stringify(content, frontmatter)
}

/**
 * Generate default frontmatter for a newly created file.
 * Derives title from filename, sets date to today.
 */
export function generateDefaultFrontmatter(
  filePath: string
): NoteFrontmatter {
  // Extract filename without extension, derive a human-readable title
  const basename = filePath.split('/').pop() ?? filePath
  const nameWithoutExt = basename.replace(/\.md$/, '')
  const title = slugToTitle(nameWithoutExt)

  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  return { title, date }
}

/** Check if a frontmatter object has no fields. */
export function isEmptyFrontmatter(fm: NoteFrontmatter): boolean {
  return Object.keys(fm).length === 0
}

/**
 * Convert a filename slug into a human-readable title.
 * "my-new-post" → "My New Post". Inverse of titleToSlug (lossy).
 */
export function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Convert a human-readable title into a safe filename slug.
 * "My New Post" → "my-new-post"
 */
export function titleToSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')       // spaces & underscores → hyphens
    .replace(/[^a-z0-9一-鿿-]/g, '') // keep letters, digits, CJK, hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '')          // trim leading/trailing hyphens
}
