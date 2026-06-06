import { tool } from 'ai'
import { z } from 'zod'

import { listFiles } from '@/lib/file-ops'

export const listFilesTool = tool({
  description: 'List all markdown files and folders in the workspace',
  inputSchema: z.object({}),
  execute: async () => {
    const files = await listFiles()
    return files.map((f) => `${f.type === 'folder' ? '📁' : '📄'} ${f.path}`)
  },
})
