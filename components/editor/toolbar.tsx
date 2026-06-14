'use client'

import { memo, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

import {
  AlertTriangle,
  Bold,
  Check,
  Code,
  ImageIcon,
  Italic,
  Link2,
  Loader2,
  Redo2,
  Sparkles,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'

import { ToolbarButton } from './toolbar-button'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

interface ToolbarProps {
  editor: Editor | null
  saveStatus?: SaveStatus
  onToggleAI?: () => void
  showAI?: boolean
}

const SaveIndicator = memo(function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  return (
    <div className="ml-auto flex items-center gap-1.5 text-xs">
      {status === 'unsaved' && (
        <span className="text-muted-foreground/40">Unsaved</span>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin text-muted-foreground/40" />
          <span className="text-muted-foreground/40">Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="size-3 text-muted-foreground/50" strokeWidth={2.5} />
          <span className="text-muted-foreground/50">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="size-3 text-destructive" strokeWidth={2} />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  )
})

function Separator() {
  return <div className="mx-1 h-4 w-px bg-border/60" />
}

export const Toolbar = memo(function Toolbar({
  editor,
  saveStatus = 'idle',
  onToggleAI,
  showAI,
}: ToolbarProps) {
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor])
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor])

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor])
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor])
  const toggleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor])
  const toggleStrike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor])
  const toggleCode = useCallback(() => editor?.chain().focus().toggleCode().run(), [editor])

  const handleLink = useCallback(() => {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('Enter URL:')
      if (url) editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const handleImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Image URL or path:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const insertTable = useCallback(
    () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    [editor],
  )
  const deleteTable = useCallback(() => editor?.chain().focus().deleteTable().run(), [editor])
  const toggleAI = useCallback(() => onToggleAI?.(), [onToggleAI])

  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 border-b border-border/40 px-3 py-1 bg-background/80 backdrop-blur-sm">
      {/* Undo / Redo */}
      <ToolbarButton
        icon={Undo2}
        tooltip="Undo"
        disabled={!editor.can().undo()}
        action={undo}
      />
      <ToolbarButton
        icon={Redo2}
        tooltip="Redo"
        disabled={!editor.can().redo()}
        action={redo}
      />

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton
        icon={Bold}
        tooltip="Bold"
        isActive={editor.isActive('bold')}
        action={toggleBold}
      />
      <ToolbarButton
        icon={Italic}
        tooltip="Italic"
        isActive={editor.isActive('italic')}
        action={toggleItalic}
      />
      <ToolbarButton
        icon={Underline}
        tooltip="Underline"
        isActive={editor.isActive('underline')}
        action={toggleUnderline}
      />
      <ToolbarButton
        icon={Strikethrough}
        tooltip="Strikethrough"
        isActive={editor.isActive('strike')}
        action={toggleStrike}
      />
      <ToolbarButton
        icon={Code}
        tooltip="Inline Code"
        isActive={editor.isActive('code')}
        action={toggleCode}
      />

      <Separator />

      {/* Link & Image */}
      <ToolbarButton
        icon={Link2}
        tooltip="Link"
        isActive={editor.isActive('link')}
        action={handleLink}
      />
      <ToolbarButton
        icon={ImageIcon}
        tooltip="Insert Image"
        action={handleImage}
      />

      <Separator />

      {/* Table */}
      <ToolbarButton
        icon={Table2}
        tooltip="Insert Table"
        action={insertTable}
      />
      <ToolbarButton
        icon={Trash2}
        tooltip="Delete Table"
        disabled={!editor.isActive('table')}
        action={deleteTable}
      />

      <SaveIndicator status={saveStatus} />

      {/* AI Toggle */}
      {onToggleAI && (
        <>
          <Separator />
          <ToolbarButton
            icon={Sparkles}
            tooltip="Toggle AI"
            isActive={showAI}
            action={toggleAI}
          />
        </>
      )}
    </div>
  )
})
