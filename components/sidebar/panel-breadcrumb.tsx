'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, PanelLeftOpen, Plus, FileText, PenTool, FolderPlus } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PanelBreadcrumbProps {
  /** Name of the root category */
  categoryName: string
  /** Breadcrumb segments after the root: [{ name, path }] */
  segments: Array<{ name: string; path: string }>
  /** Click on a segment. -1 = root, 0..n = segment index */
  onNavigate: (index: number) => void
  /** Create a new note in inbox */
  onNewNote: () => void
  /** Create a new excalidraw whiteboard in inbox */
  onNewExcalidraw?: () => void
  /** Create a new folder in current directory */
  onNewFolder?: () => void
  /** Whether the left panel is collapsed (show expand button) */
  leftCollapsed?: boolean
  /** Expand the left panel */
  onExpandLeft?: () => void
}

export function PanelBreadcrumb({
  categoryName,
  segments,
  onNavigate,
  onNewNote,
  onNewExcalidraw,
  onNewFolder,
  leftCollapsed,
  onExpandLeft,
}: PanelBreadcrumbProps) {
  const canGoBack = segments.length > 0
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen, closeMenu])

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e8e6e3] text-[0.875rem] text-[#4a4a4a]/60 min-h-[44px] bg-white">
      {leftCollapsed && onExpandLeft && (
        <button
          onClick={onExpandLeft}
          className="flex items-center justify-center size-6 rounded-md hover:bg-black/[0.04] hover:text-[#1a1a1a] transition-colors shrink-0"
          title="Show categories"
        >
          <PanelLeftOpen className="size-4" strokeWidth={1.5} />
        </button>
      )}
      {canGoBack && (
        <button
          onClick={() => onNavigate(segments.length - 2)}
          className="flex items-center justify-center size-6 rounded-md hover:bg-black/[0.04] hover:text-[#1a1a1a] transition-colors shrink-0"
          title="Go back"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </button>
      )}
      <button
        onClick={() => onNavigate(-1)}
        className={cn(
          'truncate rounded-md px-2 py-1 transition-colors hover:bg-black/[0.04] hover:text-[#1a1a1a]',
          segments.length === 0 && 'text-[#1a1a1a] font-semibold',
        )}
      >
        {categoryName}
      </button>
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="size-3 text-[#4a4a4a]/30" strokeWidth={1.5} />
          <button
            onClick={() => onNavigate(i)}
            className={cn(
              'truncate rounded-md px-2 py-1 transition-colors hover:bg-black/[0.04] hover:text-[#1a1a1a]',
              i === segments.length - 1 && 'text-[#1a1a1a] font-semibold',
            )}
          >
            {seg.name}
          </button>
        </span>
      ))}
      <div ref={menuRef} className="relative ml-auto shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center justify-center size-6 rounded-md text-[#4a4a4a]/40 hover:bg-black/[0.04] hover:text-[#1a1a1a] transition-colors"
          title="New"
        >
          <Plus className="size-4" strokeWidth={1.5} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <button
              onClick={() => { closeMenu(); onNewNote() }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileText className="size-3.5" strokeWidth={1.5} />
              New Note
            </button>
            {onNewFolder && (
              <button
                onClick={() => { closeMenu(); onNewFolder() }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <FolderPlus className="size-3.5" strokeWidth={1.5} />
                New Folder
              </button>
            )}
            {onNewExcalidraw && (
              <button
                onClick={() => { closeMenu(); onNewExcalidraw() }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <PenTool className="size-3.5" strokeWidth={1.5} />
                New Whiteboard
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
