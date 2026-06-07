'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Columns2,
  Plus,
  Rows2,
  Trash2,
} from 'lucide-react'

interface TableMenuProps {
  editor: Editor | null
}

interface MenuPosition {
  top: number
  left: number
  tableWidth: number
}

export function TableMenu({ editor }: TableMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const updatePosition = () => {
      if (!editor.isActive('table')) {
        setPosition(null)
        return
      }

      // Find the closest table DOM element from cursor position
      const { node } = editor.view.domAtPos(editor.state.selection.$head.pos)
      const tableEl = (node instanceof HTMLElement ? node : node.parentElement)?.closest('table')
      if (!tableEl) {
        setPosition(null)
        return
      }

      const rect = tableEl.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        tableWidth: rect.width,
      })
    }

    editor.on('selectionUpdate', updatePosition)
    editor.on('transaction', updatePosition)
    // Also update on scroll/resize
    const scrollParent = editor.view.dom.closest('.overflow-y-auto')
    const onScroll = () => updatePosition()
    scrollParent?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      editor.off('selectionUpdate', updatePosition)
      editor.off('transaction', updatePosition)
      scrollParent?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [editor])

  const addRowAfter = useCallback(() => editor?.chain().focus().addRowAfter().run(), [editor])
  const deleteRow = useCallback(() => editor?.chain().focus().deleteRow().run(), [editor])
  const addColumnAfter = useCallback(() => editor?.chain().focus().addColumnAfter().run(), [editor])
  const deleteColumn = useCallback(() => editor?.chain().focus().deleteColumn().run(), [editor])
  const deleteTable = useCallback(() => editor?.chain().focus().deleteTable().run(), [editor])

  if (!position || !editor) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-background p-1 shadow-md"
      style={{ top: position.top, left: position.left, width: position.tableWidth }}
    >
      {/* Row operations */}
      <button
        onClick={addRowAfter}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Add row below"
      >
        <Rows2 className="size-3.5" />
        <Plus className="size-3" />
      </button>
      <button
        onClick={deleteRow}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Delete row"
      >
        <Rows2 className="size-3.5" />
        <Trash2 className="size-3" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Column operations */}
      <button
        onClick={addColumnAfter}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Add column right"
      >
        <Columns2 className="size-3.5" />
        <Plus className="size-3" />
      </button>
      <button
        onClick={deleteColumn}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Delete column"
      >
        <Columns2 className="size-3.5" />
        <Trash2 className="size-3" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Delete table */}
      <button
        onClick={deleteTable}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Delete table"
      >
        <Trash2 className="size-3.5" />
        <span>Table</span>
      </button>
    </div>
  )
}
