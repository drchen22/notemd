import { streamText, convertToModelMessages, type StreamTextResult } from 'ai'

import { getModel } from './model'

/**
 * Tool-less, single-turn text transform for selection / inline AI modes.
 *
 * Unlike {@link panelAgent} this never loops over tools — it's a direct
 * `streamText` call tuned for transforming or generating a snippet of text.
 * The result streams back to `useChat` via `.toUIMessageStream()`.
 */

const BASE_INSTRUCTIONS = `You are NoteMD AI, a writing assistant embedded in a markdown note editor.

You help users rewrite, summarize, translate, explain, expand, shorten, or generate markdown content.
Be concise and helpful. Respond in the same language the user writes in.`

const MODE_INSTRUCTIONS: Record<string, string> = {
  selection: `\n\nIMPORTANT: The user selected text and chose an action. Return ONLY the transformed text. Do NOT include any explanation, preamble, or markdown formatting around the result. Just the raw result text.`,
  inline: `\n\nIMPORTANT: The user typed a quick prompt from their editor. Respond concisely. If generating content, return only the content itself without any preamble or explanation.`,
}

type TransformMode = 'selection' | 'inline'

export interface StreamTransformArgs {
  /** UI messages from the client (`useChat`). */
  messages: unknown[]
  /** Active file path, used as light context only (no full content injected). */
  currentFilePath?: string | null
  /** Which transform mode to apply. Defaults to 'inline'. */
  mode?: TransformMode | null
  /** Request abort signal, forwarded to the model. */
  abortSignal?: AbortSignal
}

/**
 * Run a single-turn streaming text transform.
 * Returns the `streamText` result; the caller merges `.toUIMessageStream()`.
 */
export async function streamTransform({
  messages,
  currentFilePath,
  mode = 'inline',
  abortSignal,
}: StreamTransformArgs): Promise<StreamTextResult<Record<string, never>, never>> {
  let system = BASE_INSTRUCTIONS

  if (mode && MODE_INSTRUCTIONS[mode]) {
    system += MODE_INSTRUCTIONS[mode]
  }

  if (currentFilePath) {
    system += `\n\nThe user currently has this file open: ${currentFilePath}`
  }

  return streamText({
    model: getModel(),
    system,
    messages: await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]),
    abortSignal,
  })
}
