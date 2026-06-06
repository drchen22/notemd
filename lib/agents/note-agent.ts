import { ToolLoopAgent, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

import { withReasoning } from '@/lib/ai/with-reasoning'
import {
  listFilesTool,
  readFileTool,
  writeFileTool,
  editFileTool,
} from '@/lib/tools'

/**
 * Custom fetch that injects `chat_template_kwargs: { enable_thinking: true }`
 * into the request body for the agnes API (LiteLLM).
 *
 * The @ai-sdk/openai provider strips unknown fields from providerOptions,
 * so we inject it directly into the HTTP request body instead.
 */
function withThinking(fetchFn: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (url, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body)
        if (body.model && !body.chat_template_kwargs) {
          body.chat_template_kwargs = { enable_thinking: true }
          init = { ...init, body: JSON.stringify(body) }
        }
      } catch {
        // not JSON, pass through
      }
    }
    return fetchFn(url, init)
  }
}

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? 'dummy',
  fetch: withThinking(globalThis.fetch),
})

const baseModel = openai.chat(process.env.AI_MODEL ?? 'gpt-4o-mini')

const BASE_INSTRUCTIONS = `You are NoteMD AI, a writing assistant embedded in a markdown note editor.

You can help users with:
- Reading, writing, and managing their markdown notes
- Summarizing, rewriting, translating content
- Answering questions about their notes
- Generating new content or outlines

You have access to the user's current file (provided as context). Use the tools to read other files or write changes when needed.

When writing files, always preserve the existing markdown formatting unless the user asks to change it.
Be concise and helpful. Respond in the same language the user writes in.`

const MAX_FILE_CONTENT_LENGTH = 50_000

const MODE_INSTRUCTIONS: Record<string, string> = {
  selection: `\n\nIMPORTANT: The user selected text and chose an action. Return ONLY the transformed text. Do NOT include any explanation, preamble, or markdown formatting around the result. Just the raw result text.`,
  inline: `\n\nIMPORTANT: The user typed a quick prompt from their editor. Respond concisely. If generating content, return only the content itself without any preamble or explanation.`,
}

const callOptionsSchema = z.object({
  currentFilePath: z.string().optional().nullable(),
  currentFileContent: z.string().optional().nullable(),
  mode: z.enum(['panel', 'selection', 'inline', 'fullpage']).optional().nullable(),
})

export const noteAgent = new ToolLoopAgent({
  model: withReasoning(baseModel),
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

    // Mode-specific instruction suffix
    const mode = options?.mode as string | undefined
    if (mode && MODE_INSTRUCTIONS[mode]) {
      updatedInstructions += MODE_INSTRUCTIONS[mode]
    }

    return { ...args, instructions: updatedInstructions }
  },
})

export type NoteAgentUIMessage = import('ai').InferAgentUIMessage<typeof noteAgent>
