'use client'

import { useRef, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { Send, Square, ArrowLeft, Loader2, MessageCircle, AlertCircle } from 'lucide-react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { MessageBubble } from './message-bubble'
import { EmptyState } from './empty-state'

interface FullPageChatProps {
  onClose: () => void
}

export function FullPageChat({ onClose }: FullPageChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, stop, error } = useChat<NoteAgentUIMessage>({
    id: 'fullpage-chat',
    onError: (err) => console.error('Fullpage chat error:', err),
  })

  const isLoading = status === 'streaming'

  // Auto-scroll on new messages
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
          mode: 'fullpage',
        },
      }
    )
    setInput('')
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Chat</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="mx-auto max-w-3xl px-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <EmptyState
                title="AI Chat"
                description="开始一段新的对话，我会帮你管理笔记、回答问题、或生成内容。"
                icon={MessageCircle}
              />
            </div>
          )}

          <div className="space-y-4">
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
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit}>
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-4 py-3 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20 transition-all shadow-sm">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="发送消息…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-40"
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
                }}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Square className="size-4" fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground opacity-40 transition-opacity hover:opacity-100 disabled:opacity-30"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
