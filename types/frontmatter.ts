/**
 * Strongly-typed frontmatter fields that NoteMD knows about.
 * The index signature allows arbitrary custom fields without breaking changes.
 */
export interface NoteFrontmatter {
  /** Document title (defaults to filename without extension) */
  title?: string
  /** Creation date in ISO 8601 (YYYY-MM-DD) */
  date?: string
  /** Tags for categorization */
  tags?: string[]
  /** Single category for grouping */
  category?: string
  /** Extensibility: arbitrary fields pass through untouched */
  [key: string]: unknown
}
