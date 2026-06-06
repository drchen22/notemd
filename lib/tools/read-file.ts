import { tool } from 'ai'
import { z } from 'zod'

import { readFile } from '@/lib/file-ops'

export const readFileTool = tool({
  description: 'Read the content of a markdown file',
  inputSchema: z.object({
    path: z.string().describe('Relative file path, e.g. "notes/todo.md"'),
  }),
  execute: async ({ path: filePath }) => {
    try {
      const content = await readFile(filePath)
      return { path: filePath, content }
    } catch (e) {
      return { error: (e as Error).message }
    }
  },
})
