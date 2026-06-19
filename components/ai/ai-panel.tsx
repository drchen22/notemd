'use client'

import { useRef, useEffect, useState, useCallback, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { useDocument } from '@/lib/context/document-context'
import { useLayout } from '@/lib/context/layout-context'
import { ChatInput } from './chat-input'
import { ChatMessages } from './chat-messages'
import { EmptyState } from './empty-state'

export function AIPanel() {
  const { activeFilePath: currentFilePath, markdownContent: currentFileContent, notifyFileChanged: onFileChanged } = useDocument()
  const { aiWidth: width } = useLayout()
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

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(
      { text: input },
      {
        body: {
          currentFilePath,
          currentFileContent,
        },
      },
    )
    setInput('')
  }, [input, isLoading, sendMessage, currentFilePath, currentFileContent])

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-l border-border/40 bg-background"
      style={{ width: width ?? 320 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5 min-h-[44px]">
        <span className="text-[0.8125rem] font-medium text-foreground/70">AI</span>
        {currentFilePath && (
          <span className="truncate text-xs text-muted-foreground/50">
            · {currentFilePath}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar"
      >
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          error={error}
          emptyContent={<EmptyState />}
        />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border/40 p-3">
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </form>
    </aside>
  )
}
