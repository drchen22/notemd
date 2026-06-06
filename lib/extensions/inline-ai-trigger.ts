import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const INLINE_AI_KEY = new PluginKey('inlineAiTrigger')

/**
 * Creates a Tiptap extension that detects `//` typed on an empty paragraph
 * and calls the provided callback to open the inline AI input.
 *
 * Only prevents the second '/' and notifies React — does NOT dispatch
 * any transaction to avoid scroll position resets. The '/' character
 * stays in the editor until the user chooses Insert/Discard.
 */
export function createInlineAITrigger(onTrigger: (slashPos: number) => void) {
  return Extension.create({
    name: 'inlineAiTrigger',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: INLINE_AI_KEY,
          props: {
            handleTextInput(view, _from, _to, text) {
              if (text !== '/') return false

              const { $head } = view.state.selection
              if ($head.parent.type.name !== 'paragraph') return false

              // Only trigger when the paragraph already has exactly one '/'
              const textBefore = $head.parent.textContent
              if (textBefore !== '/') return false

              // Position of the existing '/' character
              const slashPos = $head.pos - 1

              // Notify React — no transaction dispatch at all
              onTrigger(slashPos)
              return true
            },
          },
        }),
      ]
    },
  })
}
