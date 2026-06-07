/** Hoisted regex for matching markdown image syntax */
const IMAGE_REGEX = /(!\[[^\]]*\]\()([^)]+)\)/g

/** Hoisted regex for matching resolved API image paths */
const API_IMAGE_REGEX = /(!\[[^\]]*\]\()\/api\/content-files\?path=([^)]+)\)/g

/**
 * Convert relative image paths in markdown to API query URLs for display in browser.
 * e.g., ![alt](assets/img.png) → ![alt](/api/content-files?path=guides/assets/img.png)
 *
 * Only converts relative paths (not http/https, not already-absolute).
 */
export function resolveImagePaths(markdown: string, filePath: string): string {
  const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
  return markdown.replace(
    IMAGE_REGEX,
    (match, prefix, src) => {
      // Skip external URLs and already-resolved paths
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/api/')) {
        return match
      }
      // Skip absolute paths starting with /
      if (src.startsWith('/')) {
        return match
      }
      const fullSrc = dir ? `${dir}/${src}` : src
      return `${prefix}/api/content-files?path=${encodeURIComponent(fullSrc)})`
    }
  )
}

/**
 * Convert API query URLs back to relative paths for saving to markdown file.
 * e.g., ![alt](/api/content-files?path=guides/assets/img.png) → ![alt](assets/img.png)
 */
export function relativizeImagePaths(markdown: string, filePath: string): string {
  const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''

  return markdown.replace(
    API_IMAGE_REGEX,
    (match, pre, encodedSrc) => {
      const src = decodeURIComponent(encodedSrc)
      if (dir && src.startsWith(dir + '/')) {
        return `${pre}${src.substring(dir.length + 1)})`
      }
      return `${pre}${src})`
    }
  )
}
