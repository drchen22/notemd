'use client'

import { useEffect, useReducer, useRef, useState, useCallback, useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { SettingsDialog } from '@/components/settings/storage-settings'

import type { FileTreeNode } from '@/types/file-tree'

import { CategoryPanel } from './category-panel'
import { ContentsPanel } from './contents-panel'
import { type FolderOption } from './move-to-picker'

interface TwoPanelSidebarProps {
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  refreshKey?: number
  onOpenFullChat?: () => void
  /** Preload the full-page chat bundle on hover */
  onPreloadFullChat?: () => void
  onActiveFilePathChange?: (newPath: string | null) => void
  selectedCategory: string | null
  onSelectedCategoryChange: (categoryPath: string | null) => void
}

/* ── Operation state reducer ── */

type OperationState =
  | { type: 'idle' }
  | { type: 'renaming'; path: string }
  | { type: 'deleting'; path: string }
  | { type: 'creating'; parentPath: string; itemType: 'file' | 'folder' | 'excalidraw' }

type OperationAction =
  | { type: 'startRename'; path: string }
  | { type: 'startDelete'; path: string }
  | { type: 'startCreate'; parentPath: string; itemType: 'file' | 'folder' | 'excalidraw' }
  | { type: 'clear' }

const IDLE: OperationState = { type: 'idle' }

function operationReducer(_state: OperationState, action: OperationAction): OperationState {
  switch (action.type) {
    case 'startRename':
      return { type: 'renaming', path: action.path }
    case 'startDelete':
      return { type: 'deleting', path: action.path }
    case 'startCreate':
      return { type: 'creating', parentPath: action.parentPath, itemType: action.itemType }
    case 'clear':
      return IDLE
  }
}

/* ── Tree helpers (hoisted, pure) ── */

/** Derive categories and root-files node from the full tree */
function deriveCategories(tree: FileTreeNode[]) {
  const categories = tree.filter((n) => n.type === 'folder')
  const rootFiles = tree.filter((n) => n.type === 'file')
  const rootFilesNode: FileTreeNode | null =
    rootFiles.length > 0
      ? { name: 'Notes', path: '__root__', type: 'folder', children: rootFiles }
      : null
  return { categories, rootFilesNode }
}

/** Flatten all folders from the tree into a list of FolderOption (with depth for indentation) */
function flattenFolders(nodes: FileTreeNode[], depth = 0): FolderOption[] {
  const result: FolderOption[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push({ name: node.name, path: node.path, depth })
      if (node.children) {
        result.push(...flattenFolders(node.children, depth + 1))
      }
    }
  }
  return result
}

/* ── Component ── */

export function TwoPanelSidebar({
  activeFilePath,
  onFileSelect,
  refreshKey,
  onOpenFullChat,
  onPreloadFullChat,
  onActiveFilePathChange,
  selectedCategory,
  onSelectedCategoryChange,
}: TwoPanelSidebarProps) {
  const [tree, setTree] = useState<FileTreeNode[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Consolidated operation state (replaces renamingPath, deletingPath, creatingIn)
  const [operation, dispatchOperation] = useReducer(operationReducer, IDLE)
  const [internalRefreshKey, setInternalRefreshKey] = useState(0)

  // Navigation state
  const [navigationStack, setNavigationStack] = useState<string[]>([])

  // Left panel state
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [categoryPanelWidth, setCategoryPanelWidth] = useState(180)
  const CATEGORY_MIN = 120

  const handleCategoryPanelResize = useCallback((delta: number) => {
    setCategoryPanelWidth((w) => Math.max(CATEGORY_MIN, w + delta))
  }, [])

  const handleLeftCollapse = useCallback(() => setLeftCollapsed(true), [])
  const handleLeftExpand = useCallback(() => setLeftCollapsed(false), [])

  const effectiveRefreshKey = (refreshKey ?? 0) + internalRefreshKey

  // Fetch tree data
  useEffect(() => {
    let cancelled = false
    async function loadTree() {
      try {
        const res = await fetch('/api/files?action=tree')
        if (!cancelled && res.ok) {
          const data = await res.json()
          setTree(data.tree)
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadTree()
    return () => {
      cancelled = true
    }
  }, [effectiveRefreshKey])

  const refreshTree = useCallback(() => {
    setInternalRefreshKey((k) => k + 1)
  }, [])

  // Derived data
  const { categories, rootFilesNode } = useMemo(
    () => (tree ? deriveCategories(tree) : { categories: [], rootFilesNode: null }),
    [tree],
  )

  // Flat folder list for "Move to" picker
  const folders = useMemo(
    () => (tree ? flattenFolders(tree) : []),
    [tree],
  )

  // Find the selected category node
  const selectedCategoryNode = useMemo(() => {
    if (!tree || !selectedCategory) return null
    if (selectedCategory === '__root__') return rootFilesNode
    return tree.find((n) => n.path === selectedCategory && n.type === 'folder') ?? null
  }, [tree, selectedCategory, rootFilesNode])

  // Derived operation fields (for backward compat with child components)
  const renamingPath = operation.type === 'renaming' ? operation.path : null
  const deletingPath = operation.type === 'deleting' ? operation.path : null
  const creatingIn = operation.type === 'creating'
    ? { parentPath: operation.parentPath, type: operation.itemType as 'file' | 'folder' | 'excalidraw' }
    : null

  // --- Navigation handlers ---

  const handleCategorySelect = useCallback(
    (categoryPath: string) => {
      onSelectedCategoryChange(categoryPath)
      setNavigationStack([])
      dispatchOperation({ type: 'clear' })
    },
    [onSelectedCategoryChange],
  )

  const handleNavigateInto = useCallback((folderPath: string) => {
    setNavigationStack((prev) => [...prev, folderPath])
  }, [])

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === -1) {
      setNavigationStack([])
    } else {
      setNavigationStack((prev) => prev.slice(0, index + 1))
    }
  }, [])

  // --- Operation handlers ---

  const handleRenameSubmit = useCallback(
    async (itemPath: string, newName: string) => {
      dispatchOperation({ type: 'clear' })
      try {
        const res = await fetch('/api/files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rename', path: itemPath, newName }),
        })
        if (res.ok) {
          const data = await res.json()
          refreshTree()
          if (activeFilePath === itemPath && onActiveFilePathChange) {
            onActiveFilePathChange(data.newPath)
          }
        }
      } catch {
        // Silently fail
      }
    },
    [activeFilePath, onActiveFilePathChange, refreshTree],
  )

  const handleDeleteConfirm = useCallback(
    async (itemPath: string) => {
      dispatchOperation({ type: 'clear' })
      try {
        const res = await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: itemPath }),
        })
        if (res.ok) {
          refreshTree()
          if (activeFilePath === itemPath && onActiveFilePathChange) {
            onActiveFilePathChange(null)
          }
          if (itemPath === selectedCategory) {
            onSelectedCategoryChange(null)
            setNavigationStack([])
          }
        }
      } catch {
        // Silently fail
      }
    },
    [activeFilePath, onActiveFilePathChange, refreshTree, selectedCategory, onSelectedCategoryChange],
  )

  const handleCreate = useCallback(
    async (type: 'file' | 'folder' | 'excalidraw', parentPath: string, name: string) => {
      dispatchOperation({ type: 'clear' })
      const fullPath = parentPath ? `${parentPath}/${name}` : name
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: type === 'folder' ? 'create-folder' : 'create-file',
            path: fullPath,
            content: '',
          }),
        })
        if (res.ok) {
          refreshTree()
          if (type === 'file') {
            onFileSelect(fullPath.endsWith('.md') ? fullPath : fullPath + '.md')
          } else if (type === 'excalidraw') {
            onFileSelect(fullPath.endsWith('.excalidraw') ? fullPath : fullPath + '.excalidraw')
          }
        }
      } catch {
        // Silently fail
      }
    },
    [onFileSelect, refreshTree],
  )

  const handleMoveTo = useCallback(
    async (sourcePath: string, targetDir: string) => {
      try {
        const res = await fetch('/api/files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'move', sourcePath, targetDir }),
        })
        if (res.ok) {
          const data = await res.json()
          refreshTree()
          if (activeFilePath === sourcePath && onActiveFilePathChange) {
            onActiveFilePathChange(data.newPath)
          }
        }
      } catch {
        // Silently fail
      }
    },
    [activeFilePath, onActiveFilePathChange, refreshTree],
  )

  // --- Callbacks passed to tree items (stable via useMemo) ---
  const callbacks = useMemo(
    () => ({
      onRequestRename: (path: string) => dispatchOperation({ type: 'startRename', path }),
      onRequestDelete: (path: string) => dispatchOperation({ type: 'startDelete', path }),
      onCreateNote: (parentPath: string) => dispatchOperation({ type: 'startCreate', parentPath, itemType: 'file' }),
      onCreateFolder: (parentPath: string) => dispatchOperation({ type: 'startCreate', parentPath, itemType: 'folder' }),
      onCreateExcalidraw: (parentPath: string) => dispatchOperation({ type: 'startCreate', parentPath, itemType: 'excalidraw' }),
      onRenameSubmit: handleRenameSubmit,
      onRenameCancel: () => dispatchOperation({ type: 'clear' }),
      onDeleteConfirm: handleDeleteConfirm,
      onDeleteCancel: () => dispatchOperation({ type: 'clear' }),
      onCreateSubmit: handleCreate,
      onCreateCancel: () => dispatchOperation({ type: 'clear' }),
      folders,
      onMoveTo: handleMoveTo,
    }),
    [handleRenameSubmit, handleDeleteConfirm, handleCreate, folders, handleMoveTo],
  )

  // --- New note: directly create in inbox with auto-generated name ---
  const handleNewNote = useCallback(async () => {
    const baseName = 'untitled'
    const existingNames = new Set(
      tree
        ?.find((n) => n.path === 'inbox')
        ?.children?.map((c) => c.name) ?? [],
    )
    let name = baseName
    let counter = 1
    while (existingNames.has(`${name}.md`)) {
      counter++
      name = `${baseName}-${counter}`
    }

    const fullPath = `inbox/${name}.md`
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-file',
          path: fullPath,
          content: '',
        }),
      })
      if (res.ok) {
        refreshTree()
        onSelectedCategoryChange('inbox')
        setNavigationStack([])
        onFileSelect(fullPath)
      }
    } catch {
      // Silently fail
    }
  }, [tree, refreshTree, onSelectedCategoryChange, onFileSelect])

  // --- New excalidraw: directly create in inbox with auto-generated name ---
  const handleNewExcalidraw = useCallback(async () => {
    const baseName = 'untitled'
    const existingNames = new Set(
      tree
        ?.find((n) => n.path === 'inbox')
        ?.children?.map((c) => c.name) ?? [],
    )
    let name = baseName
    let counter = 1
    while (existingNames.has(`${name}.excalidraw`)) {
      counter++
      name = `${baseName}-${counter}`
    }

    const fullPath = `inbox/${name}.excalidraw`
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-file',
          path: fullPath,
          content: '',
        }),
      })
      if (res.ok) {
        refreshTree()
        onSelectedCategoryChange('inbox')
        setNavigationStack([])
        onFileSelect(fullPath)
      }
    } catch {
      // Silently fail
    }
  }, [tree, refreshTree, onSelectedCategoryChange, onFileSelect])

  return (
    <aside className="relative flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-[#e8e6e3] bg-[#F8F6F3]">
      {/* Two-panel area — fills entire height */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Categories (collapsible) */}
        {!leftCollapsed && (
          <>
            <CategoryPanel
              categories={categories}
              rootFilesNode={rootFilesNode}
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              renamingPath={renamingPath}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={callbacks.onRenameCancel}
              onRequestRename={callbacks.onRequestRename}
              onRequestDelete={(path) => dispatchOperation({ type: 'startDelete', path })}
              width={categoryPanelWidth}
              onCollapse={handleLeftCollapse}
            />
            <PanelDivider onResize={handleCategoryPanelResize} />
          </>
        )}

        {/* Right panel: Contents (always visible) */}
        <ContentsPanel
          categoryNode={selectedCategoryNode}
          navigationStack={navigationStack}
          onNavigateInto={handleNavigateInto}
          onBreadcrumbClick={handleBreadcrumbClick}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          callbacks={callbacks}
          renamingPath={renamingPath}
          deletingPath={deletingPath}
          creatingIn={creatingIn}
          isLoading={isLoading}
          onNewNote={handleNewNote}
          onNewExcalidraw={handleNewExcalidraw}
          leftCollapsed={leftCollapsed}
          onExpandLeft={handleLeftExpand}
          folders={folders}
          onMoveTo={handleMoveTo}
        />
      </div>

      {/* Footer: Chat + Settings */}
      <div className="border-t border-[#e8e6e3] px-3 py-2.5 space-y-0.5">
        {onOpenFullChat ? (
          <button
            onClick={onOpenFullChat}
            onMouseEnter={onPreloadFullChat}
            onFocus={onPreloadFullChat}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.875rem] text-[#4a4a4a]/60 transition-colors hover:bg-black/[0.04] hover:text-[#1a1a1a]"
          >
            <MessageSquare className="size-[15px] shrink-0" strokeWidth={1.5} />
            <span>新对话</span>
          </button>
        ) : null}
        <SettingsDialog />
      </div>
    </aside>
  )
}

/** Inline resizable divider strip between the two sidebar panels */
function PanelDivider({ onResize }: { onResize: (deltaX: number) => void }) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      onResize(delta)
    },
    [onResize],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative shrink-0 w-0 flex items-center justify-center cursor-col-resize group"
    >
      <div className="absolute inset-y-0 w-px bg-[#e8e6e3] group-hover:bg-[#c8c6c3] transition-all" />
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}
