import { tool } from 'ai'
import { z } from 'zod'

import { editFile } from '@/lib/file-ops'

export const editFileTool = tool({
  description:
    'Incrementally edit a markdown file by replacing an exact text match with new text. ' +
    'The oldText must appear exactly once in the file — if it appears multiple times, provide more surrounding context. ' +
    'Always use readFile first to see the current content before editing. ' +
    'Prefer this over writeFile for making partial changes.',
  inputSchema: z.object({
    path: z.string().describe('Relative file path, e.g. "notes/todo.md"'),
    oldText: z.string().describe('The exact text to find in the file'),
    newText: z.string().describe('The replacement text'),
  }),
  execute: async ({ path: filePath, oldText, newText }) => {
    try {
      const result = await editFile(filePath, oldText, newText)
      return { success: true, path: filePath, ...result }
    } catch (e) {
      return { error: (e as Error).message }
    }
  },
})
