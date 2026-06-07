'use client'

import { type ReactNode } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'
import { MessageBubble } from './message-bubble'

interface ChatMessagesProps {
  messages: NoteAgentUIMessage[]
  isLoading: boolean
  error: Error | null | undefined
  emptyContent?: ReactNode
}

export function ChatMessages({ messages, isLoading, error, emptyContent }: ChatMessagesProps) {
  return (
    <>
      {messages.length === 0 && emptyContent}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}

      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <Loader2 className="size-3 animate-spin" />
          Thinking…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span>{error.message || error.toString() || 'Something went wrong'}</span>
        </div>
      )}
    </>
  )
}
