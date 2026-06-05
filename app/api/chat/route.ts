import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

import { listFiles, readFile, writeFile, editFile } from '@/lib/file-ops'

const openai = createOpenAI({
  // Points to any OpenAI-compatible API (Ollama, LM Studio, etc.)
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? 'dummy',
})

const SYSTEM_PROMPT = `You are NoteMD AI, a writing assistant embedded in a markdown note editor.

You can help users with:
- Reading, writing, and managing their markdown notes
- Summarizing, rewriting, translating content
- Answering questions about their notes
- Generating new content or outlines

You have access to the user's current file (provided as context). Use the tools to read other files or write changes when needed.

When writing files, always preserve the existing markdown formatting unless the user asks to change it.
Be concise and helpful. Respond in the same language the user writes in.`

const tools = {
  listFiles: tool({
    description: 'List all markdown files and folders in the workspace',
    inputSchema: z.object({}),
    execute: async () => {
      const files = await listFiles()
      return files.map((f) => `${f.type === 'folder' ? '📁' : '📄'} ${f.path}`)
    },
  }),
  readFile: tool({
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
  }),
  writeFile: tool({
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
  }),
  editFile: tool({
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
  }),
}

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, currentFilePath, currentFileContent } = body as {
    messages: UIMessage[]
    currentFilePath?: string | null
    currentFileContent?: string | null
  }

  // Build system prompt with optional current file context
  let system = SYSTEM_PROMPT
  if (currentFilePath && currentFileContent !== undefined) {
    system += `\n\nThe user currently has this file open:\n---\nFile: ${currentFilePath}\nContent:\n${currentFileContent}\n---`
  }

  const modelId = process.env.AI_MODEL ?? 'gpt-4o-mini'

  const result = streamText({
    model: openai.chat(modelId),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
    providerOptions: {
      openai: {
        chat_template_kwargs: {
          enable_thinking: true,
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
