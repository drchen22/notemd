'use client'

import { useRef, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { ArrowLeft, MessageCircle } from 'lucide-react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { ChatInput } from './chat-input'
import { ChatMessages } from './chat-messages'
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

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(
      { text: input },
      {
        body: {
          mode: 'fullpage',
        },
      },
    )
    setInput('')
  }, [input, isLoading, sendMessage])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5">
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-foreground/40" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground/70">AI Chat</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="space-y-4">
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              error={error}
              emptyContent={
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <EmptyState
                    title="AI Chat"
                    description="开始一段新的对话，我会帮你管理笔记、回答问题、或生成内容。"
                    icon={MessageCircle}
                  />
                </div>
              }
            />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit}>
            <ChatInput
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              onStop={stop}
              placeholder="发送消息…"
              maxHeight={160}
            />
          </form>
        </div>
      </div>
    </div>
  )
}
