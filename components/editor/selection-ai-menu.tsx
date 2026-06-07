'use client'

import { useCallback, useRef, useState } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useChat } from '@ai-sdk/react'
import {
  PenLine,
  ListTree,
  Languages,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Check,
  X,
  Square,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { SafeMarkdown } from '@/components/ai/message-bubble'

/* ── Action definitions ── */

interface SelectionAction {
  id: string
  label: string
  icon: typeof PenLine
  prompt: string
}

const ACTIONS: SelectionAction[] = [
  { id: 'rewrite', label: '改写', icon: PenLine, prompt: '请改写以下文本，保持原意但用不同的表达方式：' },
  { id: 'summarize', label: '总结', icon: ListTree, prompt: '请总结以下文本的要点：' },
  { id: 'translate', label: '翻译', icon: Languages, prompt: '请将以下文本翻译为英文（如果是中文）或中文（如果是英文）：' },
  { id: 'explain', label: '解释', icon: Lightbulb, prompt: '请解释以下文本：' },
  { id: 'expand', label: '扩写', icon: ArrowUpRight, prompt: '请扩展以下文本，添加更多细节和内容：' },
  { id: 'shorten', label: '缩写', icon: ArrowDownRight, prompt: '请精简以下文本，保留核心内容：' },
]

/* ── Component ── */

interface SelectionAIMenuProps {
  editor: Editor
  activeFilePath: string | null
}

type Phase = 'idle' | 'responding' | 'result'

export function SelectionAIMenu({ editor, activeFilePath }: SelectionAIMenuProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const savedSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null)

  const { messages, sendMessage, status, stop, setMessages } = useChat<NoteAgentUIMessage>({
    id: 'selection-ai',
    onError: (err) => console.error('Selection AI error:', err),
  })

  const isLoading = status === 'streaming'

  // Extract the latest assistant text from messages
  const responseText = messages
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.parts.filter((p) => p.type === 'text' && p.text?.trim()))
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('\n')

  // Derive result phase during render instead of useEffect
  const resolvedPhase = phase === 'responding' && status === 'ready' && responseText ? 'result' : phase

  const triggerAction = useCallback(
    (action: SelectionAction) => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, '\n')
      if (!text.trim()) return

      savedSelectionRef.current = { from, to, text }
      setMessages([])
      setPhase('responding')

      sendMessage(
        { text: `${action.prompt}\n\n${text}` },
        {
          body: {
            currentFilePath: activeFilePath,
            mode: 'selection',
          },
        },
      )
    },
    [editor, activeFilePath, sendMessage, setMessages],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    savedSelectionRef.current = null
    setMessages([])
  }, [setMessages])

  const handleReplace = useCallback(() => {
    if (!savedSelectionRef.current || !responseText) return
    const { from, to } = savedSelectionRef.current
    editor.chain().focus().insertContentAt({ from, to }, responseText).run()
    reset()
  }, [editor, responseText, reset])

  const handleInsertBelow = useCallback(() => {
    if (!savedSelectionRef.current || !responseText) return
    const { to } = savedSelectionRef.current
    editor.chain().focus().insertContentAt(to, `\n${responseText}`).run()
    reset()
  }, [editor, responseText, reset])

  const shouldShow = useCallback(
    ({ editor: ed, state }: { editor: Editor; state: typeof editor.state }) => {
      if (resolvedPhase !== 'idle') return true
      const { from, to } = state.selection
      if (from === to) return false
      const text = state.doc.textBetween(from, to, '\n')
      if (!text.trim()) return false
      if (ed.isActive('codeBlock')) return false
      if (ed.isActive('table')) return false
      return true
    },
    [resolvedPhase, editor],
  )

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      options={{ placement: 'top', offset: { mainAxis: 8 } }}
    >
      <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg">
        {resolvedPhase === 'idle' && (
          <div className="flex items-center gap-0.5 p-1">
            {ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => triggerAction(action)}
                  title={action.label}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Icon className="size-3.5" />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {(resolvedPhase === 'responding' || resolvedPhase === 'result') && (
          <div className="max-w-sm p-3">
            {/* Streaming response */}
            <div className="text-sm leading-relaxed text-foreground mb-3 max-h-60 overflow-y-auto">
              {responseText ? (
                <SafeMarkdown text={responseText} />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  <span>AI 正在处理…</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 border-t border-border pt-2">
              {isLoading ? (
                <button
                  onClick={() => stop()}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Square className="size-3" fill="currentColor" />
                  <span>停止</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleReplace}
                    disabled={!responseText}
                    className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    <Check className="size-3" />
                    <span>替换</span>
                  </button>
                  <button
                    onClick={handleInsertBelow}
                    disabled={!responseText}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                  >
                    <span>插入到下方</span>
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  >
                    <X className="size-3" />
                    <span>取消</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  )
}
