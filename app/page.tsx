'use client'

import { startTransition, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

import { TwoPanelSidebar } from '@/components/sidebar/two-panel-sidebar'
import { AIPanel } from '@/components/ai/ai-panel'
import { ResizeHandle } from '@/components/ui/resize-handle'

import type { NoteFrontmatter } from '@/types/frontmatter'

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

const AI_MIN = 280
const AI_MAX = 560
const SIDEBAR_MIN = 200

export default function Home() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [activeFileFrontmatter, setActiveFileFrontmatter] = useState<NoteFrontmatter | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [aiWidth, setAiWidth] = useState(360)
  const [showFullChat, setShowFullChat] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(SIDEBAR_MIN, w + delta))
  }, [])

  const handleAiResize = useCallback((delta: number) => {
    setAiWidth((w) => Math.min(AI_MAX, Math.max(AI_MIN, w + delta)))
  }, [])

  const handleFileSelect = useCallback(async (filePath: string) => {
    setShowFullChat(false)
    try {
      const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
      if (res.ok) {
        const data = await res.json()
        startTransition(() => {
          setActiveFilePath(filePath)
          setMarkdownContent(data.content)
          setActiveFileFrontmatter(data.frontmatter ?? null)
        })
      }
    } catch {
      // Silently fail
    }
  }, [])

  const handleActiveFilePathChange = useCallback((newPath: string | null) => {
    startTransition(() => {
      setActiveFilePath(newPath)
      if (newPath === null) {
        setMarkdownContent(null)
        setActiveFileFrontmatter(null)
      }
    })
  }, [])

  const handleFileChanged = useCallback((filePath: string) => {
    setTreeRefreshKey((k) => k + 1)

    if (filePath === activeFilePath) {
      fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.content != null) {
            startTransition(() => {
              setMarkdownContent(data.content)
              setActiveFileFrontmatter(data.frontmatter ?? null)
            })
          }
        })
        .catch(() => {})
    }
  }, [activeFilePath])

  const handleToggleAI = useCallback(() => setShowAI((v) => !v), [])

  const handleFrontmatterChange = useCallback((fm: NoteFrontmatter) => {
    setActiveFileFrontmatter(fm)
  }, [])

  const handleOpenFullChat = useCallback(() => setShowFullChat(true), [])

  const handleCloseFullChat = useCallback(() => setShowFullChat(false), [])

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
        <TwoPanelSidebar
          activeFilePath={activeFilePath}
          onFileSelect={handleFileSelect}
          refreshKey={treeRefreshKey}
          onOpenFullChat={handleOpenFullChat}
          onPreloadFullChat={handlePreloadFullChat}
          onActiveFilePathChange={handleActiveFilePathChange}
          selectedCategory={selectedCategory}
          onSelectedCategoryChange={setSelectedCategory}
        />
        <ResizeHandle side="left" onResize={handleSidebarResize} />
      </div>

      {/* Center: Editor or Full-Page Chat */}
      <div className="min-w-0 flex-1 flex flex-col">
        {showFullChat ? (
          <FullPageChat onClose={handleCloseFullChat} />
        ) : activeFilePath?.endsWith('.excalidraw') ? (
          <ExcalidrawEditor
            sceneContent={markdownContent}
            activeFilePath={activeFilePath}
          />
        ) : (
          <NoteEditor
            markdownContent={markdownContent}
            activeFilePath={activeFilePath}
            frontmatter={activeFileFrontmatter}
            onFrontmatterChange={handleFrontmatterChange}
            onToggleAI={handleToggleAI}
            showAI={showAI}
          />
        )}
      </div>

      {/* Right: AI Panel */}
      {showAI ? (
        <div className="relative shrink-0" style={{ width: aiWidth }}>
          <ResizeHandle side="right" onResize={handleAiResize} />
          <AIPanel
            currentFilePath={activeFilePath}
            currentFileContent={markdownContent}
            onFileChanged={handleFileChanged}
            width={aiWidth}
          />
        </div>
      ) : null}
    </main>
  )
}
