import { createAgentUIStreamResponse } from 'ai'

import { noteAgent } from '@/lib/agents/note-agent'
import { requireAuth } from '@/lib/auth'

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const { messages, currentFilePath, currentFileContent, mode } = body as {
      messages: unknown[]
      currentFilePath?: string | null
      currentFileContent?: string | null
      mode?: 'panel' | 'selection' | 'inline' | 'fullpage' | null
    }

    return await createAgentUIStreamResponse({
      agent: noteAgent,
      uiMessages: messages,
      abortSignal: req.signal,
      options: {
        currentFilePath,
        currentFileContent,
        mode,
      },
    })
  } catch (err) {
    console.error('[chat/route] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
