import path from 'path'

/**
 * Get the content directory path.
 *
 * Configurable via the `CONTENT_DIR` environment variable (set in .env.local).
 * Defaults to `<project-root>/content` when not specified.
 *
 * Must be a server-only value (filesystem access), so the env var has no
 * `NEXT_PUBLIC_` prefix — it is only available in API routes and server
 * components.
 */
export function getContentDir(): string {
  const custom = process.env.CONTENT_DIR
  if (custom) {
    // Resolve relative paths against the project root so that
    // `CONTENT_DIR=./notes` works regardless of cwd.
    return path.isAbsolute(custom) ? custom : path.resolve(process.cwd(), custom)
  }
  return path.join(process.cwd(), 'content')
}
