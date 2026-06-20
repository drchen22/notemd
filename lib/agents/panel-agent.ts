import { ToolLoopAgent, stepCountIs } from 'ai'
import { z } from 'zod'

import { getModel } from '@/lib/ai/model'
import { listFilesTool } from '@/lib/tools/list-files'
import { readFileTool } from '@/lib/tools/read-file'
import { writeFileTool } from '@/lib/tools/write-file'
import { editFileTool } from '@/lib/tools/edit-file'

/**
 * General-purpose note agent for the chat panel and full-page chat.
 *
 * Has a tool loop (read/write/edit/list files) and injects the currently
 * open file as context. Single-turn text transforms (selection/inline) do
 * NOT use this agent — see `lib/ai/transform.ts` for the tool-less path.
 */

const BASE_INSTRUCTIONS = `You are NoteMD AI, a writing assistant embedded in a markdown note editor.

You can help users with:
- Reading, writing, and managing their markdown notes
- Summarizing, rewriting, translating content
- Answering questions about their notes
- Generating new content or outlines

You have access to the user's current file (provided as context). Use the tools to read other files or write changes when needed.

Files may have YAML frontmatter with metadata (title, date, tags, category). The readFile tool returns frontmatter as a separate object alongside the body content. When writing files, provide only the body content — frontmatter is preserved automatically. When creating new files, frontmatter is auto-generated.

When writing files, always preserve the existing markdown formatting unless the user asks to change it.
Be concise and helpful. Respond in the same language the user writes in.`

const MAX_FILE_CONTENT_LENGTH = 50_000

const callOptionsSchema = z.object({
  currentFilePath: z.string().optional().nullable(),
  currentFileContent: z.string().optional().nullable(),
})

export const panelAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: BASE_INSTRUCTIONS,
  tools: {
    listFiles: listFilesTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
    editFile: editFileTool,
  },
  stopWhen: stepCountIs(10),
  callOptionsSchema,
  prepareCall(args) {
    const { instructions, options } = args
    let updatedInstructions = instructions as string

    if (options?.currentFilePath && options?.currentFileContent != null) {
      const truncated =
        options.currentFileContent.length > MAX_FILE_CONTENT_LENGTH
          ? options.currentFileContent.slice(0, MAX_FILE_CONTENT_LENGTH) +
            '\n\n[... content truncated]'
          : options.currentFileContent

      updatedInstructions += `\n\nThe user currently has this file open:\n---\nFile: ${options.currentFilePath}\nContent:\n${truncated}\n---`
    }

    return { ...args, instructions: updatedInstructions }
  },
})

export type PanelAgentUIMessage = import('ai').InferAgentUIMessage<typeof panelAgent>
