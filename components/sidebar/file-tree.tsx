'use client'

import { useEffect, useState } from 'react'
import { FilePenLine, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react'

import type { FileTreeNode } from '@/types/file-tree'

import { FileTreeItem } from './file-tree-item'

interface FileTreeProps {
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  /** Increment to trigger a re-fetch of the file tree */
  refreshKey?: number
  /** Whether the sidebar is in collapsed (icon-only) mode */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapse?: () => void
  /** Current width of the sidebar (for passing to items) */
  width?: number
  /** Open the full-page AI chat */
  onOpenFullChat?: () => void
}

export function FileTree({
  activeFilePath,
  onFileSelect,
  refreshKey,
  collapsed = false,
  onToggleCollapse,
  width,
  onOpenFullChat,
}: FileTreeProps) {
  const [tree, setTree] = useState<FileTreeNode[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadTree() {
      try {
        const res = await fetch('/api/files?action=tree')
        if (!cancelled && res.ok) {
          const data = await res.json()
          setTree(data.tree)
        }
      } catch {
        // Silently fail — sidebar shows error state
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadTree()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Collapsed mode: show only an icon strip
  if (collapsed) {
    return (
      <aside className="flex h-full w-full flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
        <button
          onClick={onToggleCollapse}
          className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="relative flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary/12">
            <FilePenLine className="size-3.5 text-sidebar-primary" strokeWidth={2.2} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide text-sidebar-foreground">
            NoteMD
          </h1>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Section label */}
      <div className="px-4 pb-1.5 pt-1">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/35">
          Files
        </span>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 sidebar-scrollbar">
        {isLoading ? (
          <div className="px-2 py-3">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-5 animate-pulse rounded bg-sidebar-accent"
                  style={{ width: `${60 + i * 12}%` }}
                />
              ))}
            </div>
          </div>
        ) : tree && tree.length === 0 ? (
          <p className="px-2 py-3 text-xs text-sidebar-foreground/35 italic">
            No files found
          </p>
        ) : null}
        {tree &&
          tree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              depth={0}
            />
          ))}
      </div>

      {/* New Chat button */}
      {onOpenFullChat && (
        <div className="border-t border-sidebar-border px-3 py-2">
          <button
            onClick={onOpenFullChat}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <MessageSquare className="size-4 shrink-0" />
            <span>新对话</span>
          </button>
        </div>
      )}
    </aside>
  )
}
