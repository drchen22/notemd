'use client'

import { useRef, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { Send, Square, PenLine, Loader2, AlertCircle } from 'lucide-react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { MessageBubble } from './message-bubble'
import { EmptyState } from './empty-state'

interface AIPanelProps {
  currentFilePath: string | null
  currentFileContent: string | null
  /** Called when the AI writes or edits a file via tools */
  onFileChanged?: (filePath: string) => void
  /** Panel width in pixels (controlled by parent resize handle) */
  width?: number
}

export function AIPanel({ currentFilePath, currentFileContent, onFileChanged, width }: AIPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const notifiedToolCalls = useRef(new Set<string>())

  const { messages, sendMessage, status, stop, error } = useChat<NoteAgentUIMessage>({
    onError: (err) => {
      console.error('Chat error:', err)
    },
  })

  const isLoading = status === 'streaming'

  // Detect completed file-write tool calls and notify parent
  useEffect(() => {
    if (!onFileChanged) return
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === 'tool-writeFile' && part.state === 'output-available' && part.toolCallId) {
          const out = part.output
          if ('success' in out && out.success && 'path' in out) {
            if (!notifiedToolCalls.current.has(part.toolCallId)) {
              notifiedToolCalls.current.add(part.toolCallId)
              onFileChanged(out.path)
            }
          }
        }
        if (part.type === 'tool-editFile' && part.state === 'output-available' && part.toolCallId) {
          const out = part.output
          if ('success' in out && out.success && 'path' in out) {
            if (!notifiedToolCalls.current.has(part.toolCallId)) {
              notifiedToolCalls.current.add(part.toolCallId)
              onFileChanged(out.path)
            }
          }
        }
      }
    }
  }, [messages, onFileChanged])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(
      { text: input },
      {
        body: {
          currentFilePath,
          currentFileContent,
        },
      }
    )
    setInput('')
  }

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-l border-border bg-background"
      style={{ width: width ?? 320 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">AI</span>
        {currentFilePath && (
          <span className="truncate text-xs text-muted-foreground">
            · {currentFilePath}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar"
      >
        {messages.length === 0 && <EmptyState />}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Thinking…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error.message || error.toString() || 'Something went wrong'}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Ask about your notes…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32"
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <Square className="size-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground opacity-40 transition-opacity hover:opacity-100 disabled:opacity-30"
            >
              <Send className="size-3.5" />
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}
