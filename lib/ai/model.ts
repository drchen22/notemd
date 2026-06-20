import { createOpenAI } from '@ai-sdk/openai'

import { withReasoning } from './with-reasoning'

/**
 * Provider adapter layer.
 *
 * Centralizes all backend-specific hacks so that agents and transform calls
 * only depend on {@link getModel} and never know which provider they talk to.
 *
 * Two hacks live here, both required by OpenAI-compatible thinking backends
 * (Agnes / LiteLLM / Ollama) and no-ops elsewhere:
 *
 * 1. {@link withThinking} — injects `chat_template_kwargs.enable_thinking`
 *    into the HTTP body, because `@ai-sdk/openai` strips unknown
 *    `providerOptions` before sending.
 * 2. {@link withReasoning} — extracts `reasoning_content` / `reasoning`
 *    from raw SSE chunks and re-emits them as proper reasoning events.
 */

// Infer LanguageModelV3 from createOpenAI's chat() return type.
type LMV3 = ReturnType<ReturnType<typeof createOpenAI>['chat']>

/**
 * Custom fetch that injects `chat_template_kwargs: { enable_thinking: true }`
 * into the request body for OpenAI-compatible thinking backends (Agnes/LiteLLM).
 *
 * `@ai-sdk/openai` strips unknown fields from `providerOptions`, so we inject
 * the flag directly into the HTTP request body instead.
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

/**
 * Build the configured language model.
 *
 * Reads `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `AI_MODEL` from env. Future
 * provider additions (e.g. `@ai-sdk/anthropic`) branch here only.
 */
export function getModel(): LMV3 {
  const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY ?? 'dummy',
    fetch: withThinking(globalThis.fetch),
  })
  const baseModel = openai.chat(process.env.AI_MODEL ?? 'gpt-4o-mini')
  return withReasoning(baseModel)
}
