'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { Send, Square, Check, MessageSquarePlus, X } from 'lucide-react'
import type { Editor } from '@tiptap/react'

import { SafeMarkdown } from '@/components/ai/message-bubble'

/* ── Types ── */

interface InlineAIPosition {
  top: number
  left: number
}

interface InlineAIInputProps {
  editor: Editor
  activeFilePath: string | null
  /** Whether the inline AI is open */
  isOpen: boolean
  /** The saved cursor position in the editor (ProseMirror pos) */
  cursorPos: number
  /** The screen coordinates for floating positioning */
  coords: InlineAIPosition
  /** Close the inline AI */
  onClose: () => void
}

/* ── Component ── */

export function InlineAIInput({
  editor,
  activeFilePath,
  isOpen,
  cursorPos,
  coords,
  onClose,
}: InlineAIInputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [phase, setPhase] = useState<'input' | 'responding' | 'result'>('input')

  const { messages, sendMessage, status, stop, setMessages } = useChat<UIMessage>({
    id: 'inline-ai',
    transport: new DefaultChatTransport({ api: '/api/transform', body: { mode: 'inline' } }),
    onError: (err) => console.error('Inline AI error:', err),
  })

  const isLoading = status === 'streaming'

  /** Get text content for a specific message */
  function getMsgText(msg: UIMessage): string {
    return msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('')
  }

  // Extract ONLY the latest assistant text (for insert action)
  const responseText = useMemo(() => {
    const assistantMsgs = messages.filter((m) => m.role === 'assistant')
    const last = assistantMsgs[assistantMsgs.length - 1]
    if (!last) return ''
    return last.parts
      .filter((p) => p.type === 'text' && p.text?.trim())
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('\n')
  }, [messages])

  // Derive result phase during render instead of useEffect
  const resolvedPhase = phase === 'responding' && status === 'ready' && responseText ? 'result' : phase

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && resolvedPhase === 'input') {
      textareaRef.current?.focus()
    }
  }, [isOpen, resolvedPhase])

  // Close on ESC
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = textareaRef.current?.value
    if (!input?.trim() || isLoading) return

    setPhase('responding')
    sendMessage(
      { text: input },
      {
        body: {
          currentFilePath: activeFilePath,
        },
      },
    )
    if (textareaRef.current) textareaRef.current.value = ''
  }

  const handleDiscard = useCallback(() => {
    // Clean up the '/' trigger character left in the editor
    try {
      const { $head } = editor.state.selection
      const parentText = $head.parent.textContent
      // Only delete if the paragraph still just contains '/'
      if (parentText === '/') {
        editor.chain().deleteRange({ from: cursorPos, to: cursorPos + 1 }).run()
      }
    } catch {
      // Editor state may have changed
    }
    setPhase('input')
    setMessages([])
    onClose()
  }, [editor, cursorPos, setMessages, onClose])

  const handleInsert = useCallback(() => {
    if (!responseText) return
    // Replace the '/' trigger character with the AI response
    editor.chain()
      .focus()
      .deleteRange({ from: cursorPos, to: cursorPos + 1 })
      .insertContentAt(cursorPos, responseText)
      .run()
    handleDiscard()
  }, [editor, cursorPos, responseText, handleDiscard])

  const handleContinue = useCallback(() => {
    setPhase('input')
    // Keep messages — the next sendMessage will continue the conversation
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        handleDiscard()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleDiscard])

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-[420px] max-w-[calc(100%-2rem)]"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Chat messages area */}
        {messages.length > 0 && (
          <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-2 border-b border-border">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end'
                    : ''
                }
              >
                {msg.role === 'user' ? (
                  <p className="max-w-[80%] rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-foreground">
                    {msg.parts
                      .filter((p) => p.type === 'text')
                      .map((p) => (p as { type: 'text'; text: string }).text)
                      .join('')}
                  </p>
                ) : (
                  <div className="text-xs leading-relaxed text-foreground">
                    {(() => {
                      const text = getMsgText(msg)
                      return text ? (
                        <SafeMarkdown text={text} />
                      ) : (
                        <span className="text-muted-foreground">生成中…</span>
                      )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        {resolvedPhase === 'input' && (
          <form onSubmit={handleSubmit} className="p-2">
            <div className="flex items-end gap-1.5">
              <textarea
                ref={textareaRef}
                placeholder="Ask AI to generate content…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-24 px-2 py-1.5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 96) + 'px'
                }}
              />
              <button
                type="submit"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground opacity-40 hover:opacity-100 transition-opacity"
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Streaming controls */}
        {resolvedPhase === 'responding' && isLoading && (
          <div className="p-2 flex justify-center">
            <button
              onClick={() => stop()}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Square className="size-3" fill="currentColor" />
              <span>停止</span>
            </button>
          </div>
        )}

        {/* Result actions */}
        {resolvedPhase === 'result' && responseText && (
          <div className="p-2 flex items-center gap-1.5 border-t border-border">
            <button
              onClick={handleInsert}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Check className="size-3" />
              <span>插入</span>
            </button>
            <button
              onClick={handleContinue}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
            >
              <MessageSquarePlus className="size-3" />
              <span>继续</span>
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <X className="size-3" />
              <span>丢弃</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
