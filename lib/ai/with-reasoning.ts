import { wrapLanguageModel } from 'ai'

/**
 * Extracts reasoning/thinking content from OpenAI-compatible SSE chunks
 * and emits proper reasoning stream events.
 *
 * Many OpenAI-compatible APIs (DeepSeek, Agnes, Ollama thinking models)
 * return reasoning as `delta.reasoning_content` in streaming chunks,
 * which the standard `@ai-sdk/openai` chat provider ignores.
 *
 * Strategy:
 * 1. Use `transformParams` to enable `includeRawChunks` so the provider
 *    emits raw SSE data alongside processed chunks.
 * 2. Use `wrapStream` to intercept `type: 'raw'` chunks, extract
 *    `reasoning_content` / `reasoning` fields, and emit proper
 *    reasoning-start/delta/end events.
 */

// Infer LanguageModelV3 from wrapLanguageModel's parameter type
type LMV3 = Parameters<typeof wrapLanguageModel>[0]['model']

export function withReasoning(model: LMV3): LMV3 {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3' as const,

      // Enable raw chunks so the provider emits unparsed SSE data
      async transformParams({ params }) {
        return { ...params, includeRawChunks: true }
      },

      async wrapStream({ doStream }) {
        const result = await doStream()

        let reasoningIdx = 0
        let activeId: string | null = null

        const transformed = result.stream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              const t = (chunk as { type: string }).type

              if (t !== 'raw') {
                // Close active reasoning when text content starts
                if (activeId !== null && (t === 'text-start' || t === 'text-delta')) {
                  controller.enqueue({ type: 'reasoning-end', id: activeId })
                  activeId = null
                }
                controller.enqueue(chunk)
                return
              }

              // Extract reasoning from raw SSE data
              const rawValue = (chunk as { rawValue: RawChunk }).rawValue
              const delta = rawValue?.choices?.[0]?.delta
              if (!delta) {
                controller.enqueue(chunk)
                return
              }

              const text = delta.reasoning_content ?? delta.reasoning ?? null

              if (text != null) {
                if (!activeId) {
                  activeId = `rsn-${reasoningIdx++}`
                  controller.enqueue({ type: 'reasoning-start', id: activeId })
                }
                controller.enqueue({ type: 'reasoning-delta', id: activeId, delta: text })
                // Don't forward the raw chunk — reasoning has been extracted
              } else {
                controller.enqueue(chunk)
              }
            },

            flush(controller) {
              if (activeId != null) {
                controller.enqueue({ type: 'reasoning-end', id: activeId })
              }
            },
          }),
        )

        return { ...result, stream: transformed } as typeof result
      },
    },
  })
}

interface RawChunk {
  choices?: Array<{
    delta?: {
      reasoning_content?: string
      reasoning?: string
      [k: string]: unknown
    }
  }>
}
