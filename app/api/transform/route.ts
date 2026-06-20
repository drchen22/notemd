import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

import { streamTransform } from '@/lib/ai/transform'
import { requireAuth } from '@/lib/auth'

/**
 * Selection / inline AI route.
 * Tool-less, single-turn streaming text transform (no agent loop).
 */
export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied
  try {
    const body = await req.json()
    const { messages, currentFilePath, mode } = body as {
      messages: unknown[]
      currentFilePath?: string | null
      mode?: 'selection' | 'inline' | null
    }

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          const result = await streamTransform({
            messages,
            currentFilePath,
            mode,
            abortSignal: req.signal,
          })
          writer.merge(result.toUIMessageStream())
        },
      }),
    })
  } catch (err) {
    console.error('[transform/route] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
