'use client'

import { useMemo, memo, type ReactNode } from 'react'
import { FileText, FolderOpen, PenLine, Loader2, FileEdit, Brain, ChevronDown } from 'lucide-react'
import { useState, useCallback } from 'react'

import type { NoteAgentUIMessage } from '@/lib/agents/note-agent'

/* ── Tool metadata (hoisted) ── */

const TOOL_META: Record<string, { icon: typeof PenLine; label: string }> = {
  listFiles: { icon: FolderOpen, label: 'Listing files' },
  readFile: { icon: FileText, label: 'Reading file' },
  writeFile: { icon: PenLine, label: 'Writing file' },
  editFile: { icon: FileEdit, label: 'Editing file' },
}

const DEFAULT_TOOL_META = { icon: PenLine, label: '' } as const

/** Hoisted regex for inline formatting */
const INLINE_FORMAT_RE = /(\*\*(.+?)\*\*|`(.+?)`)/g

/* ── Message Bubble ── */

export const MessageBubble = memo(function MessageBubble({ msg }: { msg: NoteAgentUIMessage }) {
  const isUser = msg.role === 'user'

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2 text-sm text-background'
            : 'space-y-2'
        }
      >
        {[...msg.parts].sort((a, b) => {
          // Reasoning parts always render above text response
          if (a.type === 'reasoning' && b.type !== 'reasoning') return -1
          if (a.type !== 'reasoning' && b.type === 'reasoning') return 1
          return 0
        }).map((part, i) => {
          if (part.type === 'text') {
            if (!part.text?.trim()) return null
            if (isUser) {
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              )
            }
            return (
              <div key={i} className="text-sm leading-relaxed text-foreground/80">
                <SafeMarkdown text={part.text} />
              </div>
            )
          }

          // Typed tool parts
          if (
            part.type === 'tool-listFiles' ||
            part.type === 'tool-readFile' ||
            part.type === 'tool-writeFile' ||
            part.type === 'tool-editFile'
          ) {
            const toolName = part.type.slice(5) // strip "tool-" prefix
            return (
              <ToolCallBadge
                key={i}
                toolName={toolName}
                state={part.state ?? 'output-available'}
                errorText={part.state === 'output-error' ? part.errorText : undefined}
              />
            )
          }

          // Reasoning / thinking content
          if (part.type === 'reasoning') {
            return <ThinkingBlock key={i} text={part.text} state={part.state} />
          }

          return null
        })}
      </div>
    </div>
  )
})

/* ── Safe Markdown (no dangerouslySetInnerHTML) ── */

/** Inline formatting segments: bold, code, plain text */
export function formatInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  // Reset lastIndex for the hoisted global regex
  INLINE_FORMAT_RE.lastIndex = 0

  while ((match = INLINE_FORMAT_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      nodes.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      nodes.push(
        <code key={key++} className="rounded bg-secondary px-1 py-0.5 text-xs font-mono text-foreground/60">
          {match[3]}
        </code>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

export const SafeMarkdown = memo(function SafeMarkdown({ text }: { text: string }) {
  const lines = useMemo(() => {
    const split = text.split('\n')
    let start = 0
    let end = split.length
    while (start < end && split[start] === '') start++
    while (end > start && split[end - 1] === '') end--
    return split.slice(start, end)
  }, [text])

  return (
    <div className="whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <p key={i} className="font-semibold mt-2 first:mt-0">{line.slice(4)}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-base mt-2 first:mt-0">{line.slice(3)}</p>
        if (line.startsWith('# '))
          return <p key={i} className="font-semibold text-base mt-2 first:mt-0">{line.slice(2)}</p>
        if (line.startsWith('- '))
          return <p key={i} className="pl-3">{'• '}{formatInline(line.slice(2))}</p>
        if (line === '')
          return <br key={i} />
        return <p key={i}>{formatInline(line)}</p>
      })}
    </div>
  )
})

/* ── Tool Call Badge ── */

export function ToolCallBadge({
  toolName,
  state,
  errorText,
}: {
  toolName: string
  state: string
  errorText?: string
}) {
  const meta = TOOL_META[toolName] ?? { ...DEFAULT_TOOL_META, label: toolName }
  const Icon = meta.icon
  const label = meta.label

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground/60">
      <Icon className="size-3 shrink-0" strokeWidth={1.5} />
      <span>{label}</span>
      {state === 'input-streaming' || state === 'input-available' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="text-foreground/30">✓</span>
      )}
      {errorText && (
        <span className="text-destructive">{errorText}</span>
      )}
    </div>
  )
}

/* ── Thinking / Reasoning Block ── */

export function ThinkingBlock({ text, state }: { text: string; state?: string }) {
  const [open, setOpen] = useState(false)
  const isStreaming = state === 'streaming'
  const showBody = isStreaming || open

  const toggle = useCallback(() => {
    if (!isStreaming) setOpen((v) => !v)
  }, [isStreaming])

  return (
    <div className="rounded-md border border-border/30 bg-secondary/30">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground/50 hover:text-foreground/70 transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="size-3 animate-spin shrink-0" />
        ) : (
          <Brain className="size-3 shrink-0" strokeWidth={1.5} />
        )}
        <span>
          {isStreaming ? 'Thinking…' : 'Thought'}
        </span>
        {!isStreaming && (
          <ChevronDown
            className={`size-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.5}
          />
        )}
      </button>
      {showBody && text && (
        <div className="border-t border-border/30 px-3 py-2 text-xs text-muted-foreground/50 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  )
}
