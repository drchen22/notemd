'use client'

import { type ReactNode, useMemo } from 'react'

import type { FileTreeNode } from '@/types/file-tree'

import { FileTreeItem, type FileTreeItemCallbacks } from './file-tree-item'
import { NoteCard } from './note-card'
import { NewItemInput } from './new-item-input'
import { PanelBreadcrumb } from './panel-breadcrumb'
import { type FolderOption } from './move-to-picker'

interface ContentsPanelProps {
  /** The tree node for the currently selected category */
  categoryNode: FileTreeNode | null
  /** Navigation stack within the category */
  navigationStack: string[]
  /** Drill into a subfolder */
  onNavigateInto: (folderPath: string) => void
  /** Navigate to a breadcrumb level. -1 = root category, 0..n = segment index */
  onBreadcrumbClick: (index: number) => void
  /** Active file path (for highlighting) */
  activeFilePath: string | null
  /** File selection callback */
  onFileSelect: (path: string) => void
  /** All the existing file operation callbacks */
  callbacks: FileTreeItemCallbacks
  /** Operation state */
  renamingPath: string | null
  deletingPath: string | null
  creatingIn: { parentPath: string; type: 'file' | 'folder' | 'excalidraw' } | null
  /** Whether the panel is loading */
  isLoading: boolean
  /** Create a new note in inbox */
  onNewNote: () => void
  /** Create a new excalidraw whiteboard in inbox */
  onNewExcalidraw?: () => void
  /** Whether the left panel is collapsed */
  leftCollapsed?: boolean
  /** Expand the left panel */
  onExpandLeft?: () => void
  /** All available folders for "Move to" picker */
  folders: FolderOption[]
  /** Move item to a target directory */
  onMoveTo: (sourcePath: string, targetDir: string) => void
}

/** Walk the tree from categoryNode through navigationStack to find current folder's children */
function getCurrentContents(
  categoryNode: FileTreeNode,
  navigationStack: string[],
): FileTreeNode[] | null {
  let current = categoryNode
  for (const folderPath of navigationStack) {
    const child = current.children?.find(
      (c) => c.path === folderPath && c.type === 'folder',
    )
    if (!child) return null
    current = child
  }
  return current.children ?? null
}

/** Build breadcrumb segments from the navigation stack */
function getBreadcrumbSegments(
  categoryNode: FileTreeNode,
  navigationStack: string[],
): Array<{ name: string; path: string }> {
  const segments: Array<{ name: string; path: string }> = []
  let current = categoryNode
  for (const folderPath of navigationStack) {
    const child = current.children?.find(
      (c) => c.path === folderPath && c.type === 'folder',
    )
    if (!child) break
    segments.push({ name: child.name, path: child.path })
    current = child
  }
  return segments
}

export function ContentsPanel({
  categoryNode,
  navigationStack,
  onNavigateInto,
  onBreadcrumbClick,
  activeFilePath,
  onFileSelect,
  callbacks,
  renamingPath,
  deletingPath,
  creatingIn,
  isLoading,
  onNewNote,
  onNewExcalidraw,
  leftCollapsed,
  onExpandLeft,
  folders,
  onMoveTo,
}: ContentsPanelProps) {
  const contents = useMemo(
    () => categoryNode ? getCurrentContents(categoryNode, navigationStack) : null,
    [categoryNode, navigationStack],
  )

  const breadcrumbSegments = useMemo(
    () => categoryNode ? getBreadcrumbSegments(categoryNode, navigationStack) : [],
    [categoryNode, navigationStack],
  )

  // Determine if we're currently creating in the displayed folder
  const currentFolderPath = navigationStack.length > 0
    ? navigationStack[navigationStack.length - 1]
    : categoryNode?.path ?? ''
  const isCreatingHere = creatingIn?.parentPath === currentFolderPath

  // Memoize rendered items to avoid re-creating ReactNode arrays on every render
  const items = useMemo((): ReactNode[] => {
    if (!contents) return []

    const result: ReactNode[] = []

    if (isCreatingHere && creatingIn) {
      result.push(
        <NewItemInput
          key="__new-item"
          type={creatingIn.type}
          depth={0}
          onSubmit={(name) => callbacks.onCreateSubmit(creatingIn.type, currentFolderPath, name)}
          onCancel={callbacks.onCreateCancel}
        />,
      )
    }

    for (const node of contents) {
      if (node.type === 'folder') {
        result.push(
          <FileTreeItem
            key={node.path}
            node={node}
            activeFilePath={activeFilePath}
            onFileSelect={onFileSelect}
            depth={0}
            renamingPath={renamingPath}
            deletingPath={deletingPath}
            creatingIn={creatingIn}
            onFolderClick={onNavigateInto}
            {...callbacks}
          />,
        )
      } else {
        result.push(
          <NoteCard
            key={node.path}
            node={node}
            isActive={activeFilePath === node.path}
            onSelect={onFileSelect}
            onRequestRename={callbacks.onRequestRename}
            onRequestDelete={callbacks.onRequestDelete}
            onRenameSubmit={callbacks.onRenameSubmit}
            onRenameCancel={callbacks.onRenameCancel}
            onDeleteConfirm={callbacks.onDeleteConfirm}
            onDeleteCancel={callbacks.onDeleteCancel}
            isRenaming={renamingPath === node.path}
            isDeleting={deletingPath === node.path}
            folders={folders}
            onMoveTo={onMoveTo}
          />,
        )
      }
    }

    return result
  }, [contents, isCreatingHere, creatingIn, currentFolderPath, callbacks, activeFilePath, onFileSelect, renamingPath, deletingPath, onNavigateInto, folders, onMoveTo])

  // Render breadcrumb with expand button even when no category is selected
  const breadcrumb = categoryNode ? (
    <PanelBreadcrumb
      categoryName={categoryNode.name}
      segments={breadcrumbSegments}
      onNavigate={onBreadcrumbClick}
      onNewNote={onNewNote}
      onNewExcalidraw={onNewExcalidraw}
      leftCollapsed={leftCollapsed}
      onExpandLeft={onExpandLeft}
    />
  ) : (
    <PanelBreadcrumb
      categoryName=""
      segments={[]}
      onNavigate={() => {}}
      onNewNote={onNewNote}
      onNewExcalidraw={onNewExcalidraw}
      leftCollapsed={leftCollapsed}
      onExpandLeft={onExpandLeft}
    />
  )

  if (!categoryNode) {
    return (
      <div className="flex flex-col flex-1 min-w-0 bg-white">
        {breadcrumb}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#8a8a8a]">Select a category</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-white">
      {breadcrumb}

      {/* File list */}
      <div className="flex-1 overflow-y-auto sidebar-scrollbar">
        {isLoading ? (
          <div className="px-4 py-3">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-6 animate-pulse rounded bg-[#f0f0ee]"
                  style={{ width: `${70 + i * 8}%` }}
                />
              ))}
            </div>
          </div>
        ) : contents && contents.length === 0 && !isCreatingHere ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-sm text-[#8a8a8a]">
              Empty folder
            </p>
          </div>
        ) : null}
        {items}
      </div>
    </div>
  )
}
