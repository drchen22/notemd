'use client'

import { startTransition, useState } from 'react'
import dynamic from 'next/dynamic'
import { Sparkles } from 'lucide-react'

import { FileTree } from '@/components/sidebar/file-tree'
import { AIPanel } from '@/components/ai/ai-panel'

const NoteEditor = dynamic(
  () => import('@/components/editor/editor').then((mod) => mod.NoteEditor),
  { ssr: false, loading: () => <div className="flex-1 bg-background" /> }
)

export default function Home() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)

  async function handleFileSelect(filePath: string) {
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
      <FileTree activeFilePath={activeFilePath} onFileSelect={handleFileSelect} refreshKey={treeRefreshKey} />

      <div className="min-w-0 flex-1 flex flex-col">
        <NoteEditor
          markdownContent={markdownContent}
          activeFilePath={activeFilePath}
          onToggleAI={() => setShowAI((v) => !v)}
          showAI={showAI}
        />
      </div>

      {showAI && (
        <AIPanel
          currentFilePath={activeFilePath}
          currentFileContent={markdownContent}
          onFileChanged={handleFileChanged}
        />
      )}
    </main>
  )
}
