'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { startTransition } from 'react'
import { toast } from 'sonner'

import type { NoteFrontmatter } from '@/types/frontmatter'

/**
 * Document state: the currently-open file's path, content, and frontmatter,
 * plus the tree-refresh signal. Consolidates the prop-drilling that used to
 * live in app/page.tsx (4 useState + 6 callbacks).
 */

interface ChangeActivePathOptions {
  /** Bump the tree refresh counter (sidebar re-fetches). Default: false. */
  bumpTree?: boolean
}

interface DocumentContextValue {
  activeFilePath: string | null
  markdownContent: string | null
  activeFileFrontmatter: NoteFrontmatter | null
  /** Bump to make the sidebar re-fetch its tree. */
  treeRefreshKey: number
  /** Open a file by path: fetches its content and frontmatter. */
  selectFile: (filePath: string) => Promise<void>
  /**
   * Update the active path after a sidebar/editor-initiated rename/move/delete.
   * Passing null clears the document. `opts.bumpTree` refreshes the sidebar tree
   * (used when the editor renames a file, since the sidebar is unaware of it).
   */
  changeActivePath: (newPath: string | null, opts?: ChangeActivePathOptions) => void
  /** Called by the editor when frontmatter changes (drives title rename). */
  setActiveFileFrontmatter: (fm: NoteFrontmatter | null) => void
  /** Bump the tree refresh counter directly. */
  bumpTreeRefresh: () => void
  /** Called by AIPanel when a tool writes a file; re-reads it if it's active. */
  notifyFileChanged: (filePath: string) => void
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [activeFileFrontmatter, setActiveFileFrontmatter] = useState<NoteFrontmatter | null>(null)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)

  // Track the active path in a ref so notifyFileChanged doesn't go stale.
  const activeFilePathRef = useRef(activeFilePath)
  useEffect(() => {
    activeFilePathRef.current = activeFilePath
  }, [activeFilePath])

  const bumpTreeRefresh = useCallback(() => {
    setTreeRefreshKey((k) => k + 1)
  }, [])

  const selectFile = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
      if (res.ok) {
        const data = await res.json()
        startTransition(() => {
          setActiveFilePath(filePath)
          setMarkdownContent(data.content)
          setActiveFileFrontmatter(data.frontmatter ?? null)
        })
      } else {
        toast.error('打开文件失败', { description: filePath })
      }
    } catch (err) {
      console.error('[document] open file failed:', err)
      toast.error('打开文件失败')
    }
  }, [])

  const changeActivePath = useCallback(
    (newPath: string | null, opts?: ChangeActivePathOptions) => {
      startTransition(() => {
        setActiveFilePath(newPath)
        if (newPath === null) {
          setMarkdownContent(null)
          setActiveFileFrontmatter(null)
        }
        if (opts?.bumpTree) {
          setTreeRefreshKey((k) => k + 1)
        }
      })
    },
    [],
  )

  const notifyFileChanged = useCallback((filePath: string) => {
    setTreeRefreshKey((k) => k + 1)
    if (filePath !== activeFilePathRef.current) return
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
      .catch((err) => console.error('[document] reload after AI edit failed:', err))
  }, [])

  const value: DocumentContextValue = {
    activeFilePath,
    markdownContent,
    activeFileFrontmatter,
    treeRefreshKey,
    selectFile,
    changeActivePath,
    setActiveFileFrontmatter,
    bumpTreeRefresh,
    notifyFileChanged,
  }

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}

export function useDocument(): DocumentContextValue {
  const ctx = useContext(DocumentContext)
  if (!ctx) throw new Error('useDocument must be used within a DocumentProvider')
  return ctx
}
