'use client'

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

/**
 * Layout state: sidebar/AI panel widths and visibility toggles.
 * Consolidates the UI-sizing state that used to live in app/page.tsx
 * (4 useState + 4 callbacks).
 */

const AI_MIN = 280
const AI_MAX = 560
const SIDEBAR_MIN = 200

interface LayoutContextValue {
  sidebarWidth: number
  aiWidth: number
  showAI: boolean
  showFullChat: boolean
  toggleAI: () => void
  openFullChat: () => void
  closeFullChat: () => void
  /** Sidebar resize: delta added to current width, clamped to min. */
  handleSidebarResize: (delta: number) => void
  /** AI panel resize: delta added to current width, clamped to [AI_MIN, AI_MAX]. */
  handleAiResize: (delta: number) => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [showAI, setShowAI] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [aiWidth, setAiWidth] = useState(360)
  const [showFullChat, setShowFullChat] = useState(false)

  const toggleAI = useCallback(() => setShowAI((v) => !v), [])
  const openFullChat = useCallback(() => setShowFullChat(true), [])
  const closeFullChat = useCallback(() => setShowFullChat(false), [])

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(SIDEBAR_MIN, w + delta))
  }, [])

  const handleAiResize = useCallback((delta: number) => {
    setAiWidth((w) => Math.min(AI_MAX, Math.max(AI_MIN, w + delta)))
  }, [])

  const value: LayoutContextValue = {
    sidebarWidth,
    aiWidth,
    showAI,
    showFullChat,
    toggleAI,
    openFullChat,
    closeFullChat,
    handleSidebarResize,
    handleAiResize,
  }

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within a LayoutProvider')
  return ctx
}

export { AI_MIN, AI_MAX, SIDEBAR_MIN }
