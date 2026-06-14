'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'

import { TwoPanelSidebar } from '@/components/sidebar/two-panel-sidebar'
import { AIPanel } from '@/components/ai/ai-panel'
import { ResizeHandle } from '@/components/ui/resize-handle'

import { useDocument } from '@/lib/context/document-context'
import { useLayout } from '@/lib/context/layout-context'

const NoteEditor = dynamic(
  () => import('@/components/editor/editor').then((mod) => mod.NoteEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-background" /> },
)

const ExcalidrawEditor = dynamic(
  () => import('@/components/excalidraw/excalidraw-editor'),
  { ssr: false, loading: () => <div className="flex-1 bg-background" /> },
)

const FullPageChat = dynamic(
  () => import('@/components/ai/fullpage-chat').then((mod) => mod.FullPageChat),
  { ssr: false },
)

export default function Home() {
  const { activeFilePath } = useDocument()
  const { showAI, showFullChat, sidebarWidth, aiWidth, handleSidebarResize, handleAiResize, closeFullChat } = useLayout()

  // Preload FullPageChat when hovering the "新对话" button in the sidebar
  const handlePreloadFullChat = useCallback(() => {
    void import('@/components/ai/fullpage-chat')
  }, [])

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className="relative shrink-0"
        style={{ width: sidebarWidth }}
      >
        <TwoPanelSidebar onPreloadFullChat={handlePreloadFullChat} />
        <ResizeHandle side="left" onResize={handleSidebarResize} />
      </div>

      {/* Center: Editor or Full-Page Chat */}
      <div className="min-w-0 flex-1 flex flex-col">
        {showFullChat ? (
          <FullPageChat onClose={closeFullChat} />
        ) : activeFilePath?.endsWith('.excalidraw') ? (
          <ExcalidrawEditor />
        ) : (
          <NoteEditor />
        )}
      </div>

      {/* Right: AI Panel */}
      {showAI ? (
        <div className="relative shrink-0" style={{ width: aiWidth }}>
          <ResizeHandle side="right" onResize={handleAiResize} />
          <AIPanel />
        </div>
      ) : null}
    </main>
  )
}
