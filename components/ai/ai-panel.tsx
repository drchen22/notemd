'use client'

import { useRef, useEffect, useState, type FormEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { Send, Square, FileText, FolderOpen, PenLine, Loader2, FileEdit } from 'lucide-react'

interface AIPanelProps {
  currentFilePath: string | null
  currentFileContent: string | null
  /** Called when the AI writes or edits a file via tools */
  onFileChanged?: (filePath: string) => void
}

/** Tool names that modify files */
const FILE_WRITE_TOOLS = new Set(['writeFile', 'editFile'])

export function AIPanel({ currentFilePath, currentFileContent, onFileChanged }: AIPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const notifiedToolCalls = useRef(new Set<string>())

  const { messages, sendMessage, status, stop } = useChat()

  const isLoading = status === 'streaming'

  // Detect completed file-write tool calls and notify parent
  useEffect(() => {
    if (!onFileChanged) return
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (!part.type.startsWith('tool-')) continue
        // AI SDK v6 tool part type: `tool-${toolName}`, e.g. "tool-writeFile"
        const toolName = part.type.slice(5) // strip "tool-" prefix
        const toolPart = part as {
          type: string
          state?: string
          output?: { success?: boolean; path?: string; error?: string }
          toolCallId?: string
        }
        if (
          FILE_WRITE_TOOLS.has(toolName) &&
          toolPart.state === 'output-available' &&
          toolPart.output?.success &&
          toolPart.output?.path &&
          toolPart.toolCallId
        ) {
          if (!notifiedToolCalls.current.has(toolPart.toolCallId)) {
            notifiedToolCalls.current.add(toolPart.toolCallId)
            onFileChanged(toolPart.output.path)
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
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-background">
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

/* ── Message Bubble ── */

import type { UIMessage } from 'ai'

function MessageBubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user'

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground'
            : 'space-y-2'
        }
      >
        {msg.parts.map((part, i) => {
          if (part.type === 'text') {
            if (isUser) {
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              )
            }
            return (
              <div key={i} className="text-sm leading-relaxed text-foreground">
                <MessageText text={part.text} />
              </div>
            )
          }

          if (part.type.startsWith('tool-')) {
            // AI SDK v6: type is `tool-${toolName}`, extract name from it
            const toolName = part.type.slice(5)
            const toolPart = part as {
              type: string
              state?: string
              output?: unknown
              errorText?: string
            }
            return (
              <ToolCallBadge
                key={i}
                toolName={toolName}
                state={toolPart.state ?? 'output-available'}
                result={toolPart.output}
                errorText={toolPart.errorText}
              />
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

/* ── Empty State ── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-secondary">
        <PenLine className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">AI Writing Assistant</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[200px]">
        Ask me to summarize, rewrite, translate, or brainstorm ideas for your notes.
      </p>
    </div>
  )
}

/* ── Message Text (basic markdown) ── */

function MessageText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {text.split('\n').map((line, i) => {
        const parsed = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/`(.+?)`/g, '<code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono text-copper">$1</code>')

        if (line.startsWith('### '))
          return <p key={i} className="font-semibold mt-2 first:mt-0">{line.slice(4)}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-base mt-2 first:mt-0">{line.slice(3)}</p>
        if (line.startsWith('# '))
          return <p key={i} className="font-semibold text-base mt-2 first:mt-0">{line.slice(2)}</p>
        if (line.startsWith('- '))
          return <p key={i} className="pl-3">• {parsed.slice(2)}</p>
        if (line === '')
          return <br key={i} />
        return <p key={i} dangerouslySetInnerHTML={{ __html: parsed }} />
      })}
    </div>
  )
}

/* ── Tool Call Badge ── */

function ToolCallBadge({
  toolName,
  state,
  result,
  errorText,
}: {
  toolName: string
  state: string
  result?: unknown
  errorText?: string
}) {
  const toolMeta: Record<string, { icon: typeof PenLine; label: string }> = {
    listFiles: { icon: FolderOpen, label: 'Listing files' },
    readFile: { icon: FileText, label: 'Reading file' },
    writeFile: { icon: PenLine, label: 'Writing file' },
    editFile: { icon: FileEdit, label: 'Editing file' },
  }
  const meta = toolMeta[toolName] ?? { icon: PenLine, label: toolName }
  const Icon = meta.icon
  const label = meta.label

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" />
      <span>{label}</span>
      {state === 'input-streaming' || state === 'input-available' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="text-[oklch(0.62_0.14_145)]">✓</span>
      )}
      {errorText && (
        <span className="text-destructive">{errorText}</span>
      )}
    </div>
  )
}
