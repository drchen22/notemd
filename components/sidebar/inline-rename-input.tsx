'use client'

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

interface InlineRenameInputProps {
  initialName: string
  onSubmit: (newName: string) => void
  onCancel: () => void
  depth: number
  className?: string
}

export function InlineRenameInput({
  initialName,
  onSubmit,
  onCancel,
  depth,
  className,
}: InlineRenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Strip known extension for editing (will be re-added on submit if it's a file)
  const isMd = initialName.endsWith('.md')
  const isExcalidraw = initialName.endsWith('.excalidraw')
  const isFile = isMd || isExcalidraw
  const ext = isMd ? '.md' : isExcalidraw ? '.excalidraw' : ''
  const bareName = isFile ? initialName.slice(0, -ext.length) : initialName

  useEffect(() => {
    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }, [])

  const commit = useCallback(() => {
    const raw = inputRef.current?.value.trim() ?? ''
    if (!raw) {
      onCancel()
      return
    }
    // Re-append extension if the original was a file and user didn't type it
    const newName = isFile && ext && !raw.endsWith(ext) ? raw + ext : raw
    if (newName === initialName) {
      onCancel()
      return
    }
    // Basic validation
    if (raw.includes('/') || raw.includes('\\') || raw.includes('..') || raw.startsWith('.')) {
      onCancel()
      return
    }
    onSubmit(newName)
  }, [initialName, isFile, ext, onCancel, onSubmit])

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

  return (
    <input
      ref={inputRef}
      defaultValue={bareName}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      className={cn(
        'h-6 w-full rounded border border-sidebar-primary/40 bg-sidebar px-1.5 text-[0.8125rem] text-sidebar-foreground outline-none focus:border-sidebar-primary/70',
        className,
      )}
      style={{ marginLeft: `${depth * 16 + 20}px` }}
      spellCheck={false}
    />
  )
}
