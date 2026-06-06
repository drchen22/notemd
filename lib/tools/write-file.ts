import { tool } from 'ai'
import { z } from 'zod'

import { writeFile } from '@/lib/file-ops'

export const writeFileTool = tool({
  description:
    'Write full content to a markdown file. Creates the file if it does not exist. ' +
    'WARNING: This replaces the entire file content. For making partial changes, prefer the editFile tool instead to avoid losing existing content.',
  inputSchema: z.object({
    path: z.string().describe('Relative file path, e.g. "notes/new.md"'),
    content: z.string().describe('The full markdown content to write'),
  }),
  execute: async ({ path: filePath, content }) => {
    try {
      await writeFile(filePath, content)
      return { success: true, path: filePath }
    } catch (e) {
      return { error: (e as Error).message }
    }
  },
})
