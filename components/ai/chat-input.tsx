'use client'

import { type FormEvent } from 'react'
import { Send, Square } from 'lucide-react'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  isLoading: boolean
  onStop: () => void
  placeholder?: string
  maxHeight?: number
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  placeholder = 'Ask about your notes…',
  maxHeight = 128,
}: ChatInputProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e)
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 focus-within:border-foreground/15 focus-within:ring-0 transition-all">
      <textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/35"
        style={{ maxHeight }}
        onInput={handleInput}
      />
      {isLoading ? (
        <button
          type="button"
          onClick={onStop}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Square className="size-3.5" fill="currentColor" strokeWidth={0} />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background opacity-25 transition-opacity hover:opacity-60 disabled:opacity-15"
        >
          <Send className="size-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
