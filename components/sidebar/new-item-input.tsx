'use client'

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { FileText, Folder, PenTool } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NewItemInputProps {
  type: 'file' | 'folder' | 'excalidraw'
  depth: number
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function NewItemInput({ type, depth, onSubmit, onCancel }: NewItemInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (input) {
      input.focus()
    }
  }, [])

  const commit = useCallback(() => {
    const raw = inputRef.current?.value.trim() ?? ''
    if (!raw) {
      onCancel()
      return
    }
    // Validate
    if (raw.includes('/') || raw.includes('\\') || raw.includes('..') || raw.startsWith('.')) {
      onCancel()
      return
    }
    // For files, auto-append extension if missing
    let name = raw
    if (type === 'file' && !name.endsWith('.md')) {
      name += '.md'
    } else if (type === 'excalidraw' && !name.endsWith('.excalidraw')) {
      name += '.excalidraw'
    }
    onSubmit(name)
  }, [type, onCancel, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [commit, onCancel]
  )

  const handleBlur = useCallback(() => {
    // Small delay to avoid blur firing before click on suggestion
    setTimeout(commit, 100)
  }, [commit])

  const Icon = type === 'excalidraw' ? PenTool : type === 'file' ? FileText : Folder

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-[7px] text-[0.8125rem] text-sidebar-foreground/75',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Icon className="size-4 shrink-0 text-sidebar-foreground/30" />
      <input
        ref={inputRef}
        placeholder={type === 'excalidraw' ? 'untitled.excalidraw' : type === 'file' ? 'untitled.md' : 'New Folder'}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-5 w-full rounded border border-sidebar-primary/40 bg-sidebar px-1.5 text-[0.8125rem] text-sidebar-foreground outline-none focus:border-sidebar-primary/70"
        spellCheck={false}
      />
    </div>
  )
}
