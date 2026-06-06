'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'

import { editorExtensions } from '@/lib/editor-extensions'
import { createInlineAITrigger } from '@/lib/extensions/inline-ai-trigger'
import { resolveImagePaths, relativizeImagePaths } from '@/lib/image-paths'

import { CodeBlockLangMenu } from './code-block-lang-menu'
import { TableMenu } from './table-menu'
import { Toolbar } from './toolbar'
import { SelectionAIMenu } from './selection-ai-menu'
import { InlineAIInput } from './inline-ai-input'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'

interface InlineAIState {
  isOpen: boolean
  cursorPos: number
  coords: { top: number; left: number }
}

interface NoteEditorProps {
  markdownContent?: string | null
  activeFilePath?: string | null
  onToggleAI?: () => void
  showAI?: boolean
}

const DEBOUNCE_MS = 1500
const DEFAULT_CONTENT = '<h1>Welcome to NoteMD</h1><p>Start writing, or open a file from the sidebar…</p>'

export function NoteEditor({ markdownContent, activeFilePath, onToggleAI, showAI }: NoteEditorProps) {
  const lastLoadedRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isExternalUpdateRef = useRef(false)
  const lastSavedMarkdownRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  // Inline AI state
  const [inlineAI, setInlineAI] = useState<InlineAIState>({
    isOpen: false,
    cursorPos: 0,
    coords: { top: 0, left: 0 },
  })

  const openInlineAI = useCallback((slashPos: number) => {
    // Called synchronously from ProseMirror's handleTextInput.
    // NO editor transactions — just calculate position and set state.
    const editor = editorRef.current
    const scrollEl = scrollContainerRef.current
    if (!editor || !scrollEl) return

    try {
      // Calculate floating position from the slash position
      // coordsAtPos uses the CURRENT document state (slash is still there)
      const viewCoords = editor.view.coordsAtPos(slashPos)
      const containerRect = scrollEl.getBoundingClientRect()
      const left = Math.max(8, Math.min(
        viewCoords.left - containerRect.left,
        containerRect.width - 440,
      ))
      // Position below the line with the slash
      const top = viewCoords.bottom - containerRect.top + scrollEl.scrollTop + 8

      setInlineAI({ isOpen: true, cursorPos: slashPos, coords: { top, left } })
    } catch {
      setInlineAI({ isOpen: true, cursorPos: slashPos, coords: { top: 0, left: 0 } })
    }
  }, [])

  const closeInlineAI = useCallback(() => {
    setInlineAI((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      const formData = new FormData()
      formData.append('file', file)
      if (activeFilePath) {
        formData.append('filePath', activeFilePath)
      }
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          const dir = activeFilePath
            ? activeFilePath.includes('/')
              ? activeFilePath.substring(0, activeFilePath.lastIndexOf('/'))
              : ''
            : ''
          const fullSrc = dir ? `${dir}/${data.path}` : data.path
          return `/api/content-files?path=${encodeURIComponent(fullSrc)}`
        }
      } catch {
        // Upload failed
      }
      return null
    },
    [activeFilePath]
  )

  const saveFile = useCallback(
    async (rawMarkdown: string) => {
      if (!activeFilePath) return
      const markdown = relativizeImagePaths(rawMarkdown, activeFilePath)
      if (markdown === lastSavedMarkdownRef.current) return
      setSaveStatus('saving')
      try {
        const res = await fetch('/api/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: activeFilePath, content: markdown }),
        })
        if (res.ok) {
          lastSavedMarkdownRef.current = markdown
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        } else {
          setSaveStatus('unsaved')
        }
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [activeFilePath]
  )

  const editor = useEditor({
    extensions: [...editorExtensions, createInlineAITrigger(openInlineAI)],
    content: DEFAULT_CONTENT,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-full focus:outline-none',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              uploadImage(file).then((src) => {
                if (src) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src })
                    )
                  )
                }
              })
            }
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false

        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            uploadImage(file).then((src) => {
              if (src) {
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
                if (pos) {
                  view.dispatch(
                    view.state.tr.insert(pos.pos, view.state.schema.nodes.image.create({ src }))
                  )
                }
              }
            })
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isExternalUpdateRef.current) {
        isExternalUpdateRef.current = false
        return
      }
      if (!activeFilePath) return
      const currentMarkdown = relativizeImagePaths(ed.getMarkdown(), activeFilePath)
      if (currentMarkdown === lastSavedMarkdownRef.current) {
        setSaveStatus('idle')
        return
      }
      setSaveStatus('unsaved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveFile(ed.getMarkdown())
      }, DEBOUNCE_MS)
    },
  })

  // Keep editorRef in sync
  editorRef.current = editor

  // Load external markdown content
  useEffect(() => {
    if (!editor || !markdownContent || markdownContent === lastLoadedRef.current) return
    lastLoadedRef.current = markdownContent
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    lastSavedMarkdownRef.current = markdownContent
    setSaveStatus('idle')
    isExternalUpdateRef.current = true
    const resolved = activeFilePath
      ? resolveImagePaths(markdownContent, activeFilePath)
      : markdownContent
    editor.commands.setContent(resolved, { contentType: 'markdown' })
  }, [editor, markdownContent, activeFilePath])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (!editor) return null

  return (
    <div className="flex h-full flex-col bg-background">
      <Toolbar editor={editor} saveStatus={saveStatus} onToggleAI={onToggleAI} showAI={showAI} />
      <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto paper-texture custom-scrollbar">
        <div className="mx-auto max-w-[42rem] px-8 pt-10 pb-[50vh]">
          <EditorContent editor={editor} />
        </div>
        <CodeBlockLangMenu editor={editor} />
        <SelectionAIMenu editor={editor} activeFilePath={activeFilePath ?? null} />
        <InlineAIInput
          editor={editor}
          activeFilePath={activeFilePath ?? null}
          isOpen={inlineAI.isOpen}
          cursorPos={inlineAI.cursorPos}
          coords={inlineAI.coords}
          onClose={closeInlineAI}
        />
      </div>
      <TableMenu editor={editor} />
    </div>
  )
}
