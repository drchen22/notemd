import { createAgentUIStreamResponse } from 'ai'

import { panelAgent } from '@/lib/agents/panel-agent'
import { requireAuth } from '@/lib/auth'

/**
 * Chat panel / full-page chat route.
 * Runs the tool-loop {@link panelAgent}. Selection/inline transforms are
 * served by `/api/transform` instead.
 */
export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const { messages, currentFilePath, currentFileContent } = body as {
      messages: unknown[]
      currentFilePath?: string | null
      currentFileContent?: string | null
    }

    return await createAgentUIStreamResponse({
      agent: panelAgent,
      uiMessages: messages,
      abortSignal: req.signal,
      options: {
        currentFilePath,
        currentFileContent,
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
