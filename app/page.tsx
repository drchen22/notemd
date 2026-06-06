'use client'

import { startTransition, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

import { FileTree } from '@/components/sidebar/file-tree'
import { AIPanel } from '@/components/ai/ai-panel'
import { FullPageChat } from '@/components/ai/fullpage-chat'
import { ResizeHandle } from '@/components/ui/resize-handle'

const NoteEditor = dynamic(
  () => import('@/components/editor/editor').then((mod) => mod.NoteEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-background" /> },
)

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const AI_MIN = 280
const AI_MAX = 560

export default function Home() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [aiWidth, setAiWidth] = useState(360)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showFullChat, setShowFullChat] = useState(false)

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)))
  }, [])

  const handleAiResize = useCallback((delta: number) => {
    setAiWidth((w) => Math.min(AI_MAX, Math.max(AI_MIN, w + delta)))
  }, [])

  async function handleFileSelect(filePath: string) {
    // Switch back to editor if full-page chat is open
    setShowFullChat(false)
    startTransition(() => {
      setActiveFilePath(filePath)
    })
    try {
      const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
      if (res.ok) {
        const data = await res.json()
        startTransition(() => {
          setMarkdownContent(data.content)
        })
      }
    } catch {
      // Silently fail
    }
  }

  /** Called when AI writes/edits a file — refresh editor if active, always refresh tree */
  function handleFileChanged(filePath: string) {
    // Refresh file tree (new files may appear)
    setTreeRefreshKey((k) => k + 1)

    // If the changed file is the currently active file, re-fetch its content
    if (filePath === activeFilePath) {
      fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.content != null) {
            startTransition(() => {
              setMarkdownContent(data.content)
            })
          }
        })
        .catch(() => {})
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      {/* File Tree Sidebar */}
      <div
        className="relative shrink-0"
        style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}
      >
        <FileTree
          activeFilePath={activeFilePath}
          onFileSelect={handleFileSelect}
          refreshKey={treeRefreshKey}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          width={sidebarCollapsed ? 48 : sidebarWidth}
          onOpenFullChat={() => setShowFullChat(true)}
        />
        {!sidebarCollapsed && (
          <ResizeHandle side="left" onResize={handleSidebarResize} />
        )}
      </div>

      {/* Center: Editor or Full-Page Chat */}
      <div className="min-w-0 flex-1 flex flex-col">
        {showFullChat ? (
          <FullPageChat onClose={() => setShowFullChat(false)} />
        ) : (
          <NoteEditor
            markdownContent={markdownContent}
            activeFilePath={activeFilePath}
            onToggleAI={() => setShowAI((v) => !v)}
            showAI={showAI}
          />
        )}
      </div>

      {/* Right: AI Panel */}
      {showAI && (
        <div className="relative shrink-0" style={{ width: aiWidth }}>
          <ResizeHandle side="right" onResize={handleAiResize} />
          <AIPanel
            currentFilePath={activeFilePath}
            currentFileContent={markdownContent}
            onFileChanged={handleFileChanged}
            width={aiWidth}
          />
        </div>
      )}
    </main>
  )
}
