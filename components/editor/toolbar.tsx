'use client'

import { memo, useCallback, useMemo, type MouseEvent } from 'react'
import type { Editor } from '@tiptap/react'

import {
  Bold,
  Check,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Redo2,
  Sparkles,
  Strikethrough,
  Table2,
  TextQuote,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'

import { ToolbarButton } from './toolbar-button'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'

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
        <span className="text-muted-foreground/60">Unsaved</span>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin text-muted-foreground/50" />
          <span className="text-muted-foreground/60">Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="size-3 text-[oklch(0.62_0.14_145)]" strokeWidth={2.5} />
          <span className="text-[oklch(0.62_0.14_145)]">Saved</span>
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
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 border-b border-border/60 px-3 py-1.5 bg-background/80 backdrop-blur-sm">
      {/* Undo / Redo */}
      <ToolbarButton
        icon={Undo2}
        tooltip="Undo"
        disabled={!editor.can().undo()}
        action={useCallback(() => editor.chain().focus().undo().run(), [editor])}
      />
      <ToolbarButton
        icon={Redo2}
        tooltip="Redo"
        disabled={!editor.can().redo()}
        action={useCallback(() => editor.chain().focus().redo().run(), [editor])}
      />

      <Separator />

      {/* Headings */}
      <ToolbarButton
        icon={Heading1}
        tooltip="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        action={useCallback(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), [editor])}
      />
      <ToolbarButton
        icon={Heading2}
        tooltip="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        action={useCallback(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), [editor])}
      />
      <ToolbarButton
        icon={Heading3}
        tooltip="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        action={useCallback(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), [editor])}
      />

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton
        icon={Bold}
        tooltip="Bold"
        isActive={editor.isActive('bold')}
        action={useCallback(() => editor.chain().focus().toggleBold().run(), [editor])}
      />
      <ToolbarButton
        icon={Italic}
        tooltip="Italic"
        isActive={editor.isActive('italic')}
        action={useCallback(() => editor.chain().focus().toggleItalic().run(), [editor])}
      />
      <ToolbarButton
        icon={Underline}
        tooltip="Underline"
        isActive={editor.isActive('underline')}
        action={useCallback(() => editor.chain().focus().toggleUnderline().run(), [editor])}
      />
      <ToolbarButton
        icon={Strikethrough}
        tooltip="Strikethrough"
        isActive={editor.isActive('strike')}
        action={useCallback(() => editor.chain().focus().toggleStrike().run(), [editor])}
      />
      <ToolbarButton
        icon={Code}
        tooltip="Inline Code"
        isActive={editor.isActive('code')}
        action={useCallback(() => editor.chain().focus().toggleCode().run(), [editor])}
      />

      <Separator />

      {/* Block elements */}
      <ToolbarButton
        icon={List}
        tooltip="Bullet List"
        isActive={editor.isActive('bulletList')}
        action={useCallback(() => editor.chain().focus().toggleBulletList().run(), [editor])}
      />
      <ToolbarButton
        icon={ListOrdered}
        tooltip="Ordered List"
        isActive={editor.isActive('orderedList')}
        action={useCallback(() => editor.chain().focus().toggleOrderedList().run(), [editor])}
      />
      <ToolbarButton
        icon={TextQuote}
        tooltip="Blockquote"
        isActive={editor.isActive('blockquote')}
        action={useCallback(() => editor.chain().focus().toggleBlockquote().run(), [editor])}
      />
      <ToolbarButton
        icon={Code2}
        tooltip="Code Block"
        isActive={editor.isActive('codeBlock')}
        action={useCallback(() => editor.chain().focus().toggleCodeBlock().run(), [editor])}
      />
      <ToolbarButton
        icon={ListChecks}
        tooltip="Task List"
        isActive={editor.isActive('taskList')}
        action={useCallback(() => editor.chain().focus().toggleTaskList().run(), [editor])}
      />

      <Separator />

      {/* Link & HR */}
      <ToolbarButton
        icon={Link2}
        tooltip="Link"
        isActive={editor.isActive('link')}
        action={useCallback(() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
          } else {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }
        }, [editor])}
      />
      <ToolbarButton
        icon={Minus}
        tooltip="Horizontal Rule"
        action={useCallback(() => editor.chain().focus().setHorizontalRule().run(), [editor])}
      />
      <ToolbarButton
        icon={ImageIcon}
        tooltip="Insert Image"
        action={useCallback(() => {
          const url = window.prompt('Image URL or path:')
          if (url) {
            editor.chain().focus().setImage({ src: url }).run()
          }
        }, [editor])}
      />

      <Separator />

      {/* Table */}
      <ToolbarButton
        icon={Table2}
        tooltip="Insert Table"
        action={useCallback(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), [editor])}
      />
      <ToolbarButton
        icon={Trash2}
        tooltip="Delete Table"
        disabled={!editor.isActive('table')}
        action={useCallback(() => editor.chain().focus().deleteTable().run(), [editor])}
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
            action={useCallback(() => onToggleAI(), [onToggleAI])}
          />
        </>
      )}
    </div>
  )
})
