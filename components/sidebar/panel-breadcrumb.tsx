'use client'

import { ChevronLeft, ChevronRight, PanelLeftOpen, Plus } from 'lucide-react'

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
  leftCollapsed,
  onExpandLeft,
}: PanelBreadcrumbProps) {
  const canGoBack = segments.length > 0

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
      <button
        onClick={onNewNote}
        className="ml-auto flex items-center justify-center size-6 rounded-md text-[#4a4a4a]/40 hover:bg-black/[0.04] hover:text-[#1a1a1a] transition-colors shrink-0"
        title="New note"
      >
        <Plus className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  )
}
