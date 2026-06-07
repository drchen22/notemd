import { tool } from 'ai'
import { z } from 'zod'

import { writeFile, readFile } from '@/lib/file-ops'
import { parseFrontmatter, isEmptyFrontmatter, generateDefaultFrontmatter } from '@/lib/frontmatter'

export const writeFileTool = tool({
  description:
    'Write full content to a markdown file. Creates the file if it does not exist. ' +
    'Frontmatter (title, date, tags, category) is preserved automatically — just provide the body content. ' +
    'WARNING: This replaces the entire file body. For making partial changes, prefer the editFile tool instead.',
  inputSchema: z.object({
    path: z.string().describe('Relative file path, e.g. "notes/new.md"'),
    content: z.string().describe('The full markdown body content to write (without frontmatter)'),
  }),
  execute: async ({ path: filePath, content }) => {
    try {
      // Check if the AI explicitly included frontmatter in the content
      const parsed = parseFrontmatter(content)

      if (!isEmptyFrontmatter(parsed.frontmatter)) {
        // AI provided explicit frontmatter — use it
        await writeFile(filePath, parsed.content, parsed.frontmatter)
      } else {
        // AI wrote body-only content — preserve existing frontmatter
        try {
          const existing = await readFile(filePath)
          await writeFile(filePath, content, existing.frontmatter)
        } catch {
          // New file — write with auto-generated frontmatter
          const defaultFm = generateDefaultFrontmatter(filePath)
          await writeFile(filePath, content, defaultFm)
        }
      }

      return { success: true, path: filePath }
    } catch (e) {
      return { error: (e as Error).message }
    }
  },
})
