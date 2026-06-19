'use client'

import { useState, useCallback, useMemo } from 'react'
import { PanelLeftClose, FolderPlus } from 'lucide-react'

import type { FileTreeNode } from '@/types/file-tree'

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { NewItemInput } from './new-item-input'
import { CategoryItem } from './category-item'

/** Stable no-op so memoized children don't re-render when given unused handlers */
const noop = () => {}

interface CategoryPanelProps {
  /** Top-level folder nodes (categories) */
  categories: FileTreeNode[]
  /** Virtual root node for root-level .md files */
  rootFilesNode: FileTreeNode | null
  /** Path of the currently selected category */
  selectedCategory: string | null
  /** Callback when a category is clicked */
  onCategorySelect: (categoryPath: string) => void
  /** Currently renaming path */
  renamingPath: string | null
  /** Submit rename */
  onRenameSubmit: (path: string, newName: string) => void
  /** Cancel rename */
  onRenameCancel: () => void
  /** Request rename */
  onRequestRename: (path: string) => void
  /** Request delete */
  onRequestDelete: (path: string) => void
  /** Panel width in pixels */
  width: number
  /** Collapse the left panel */
  onCollapse?: () => void
  /** Create a subfolder inside a category */
  onCreateFolder: (parentPath: string) => void
  /** Create a top-level folder */
  onCreateTopFolder: () => void
  /** Currently creating in this path */
  creatingIn: { parentPath: string; type: 'file' | 'folder' } | null
  /** Submit creation */
  onCreateSubmit: (type: 'file' | 'folder', parentPath: string, name: string) => void
  /** Cancel creation */
  onCreateCancel: () => void
}

export function CategoryPanel({
  categories,
  rootFilesNode,
  selectedCategory,
  onCategorySelect,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  onRequestRename,
  onRequestDelete,
  width,
  onCollapse,
  onCreateFolder,
  onCreateTopFolder,
  creatingIn,
  onCreateSubmit,
  onCreateCancel,
}: CategoryPanelProps) {
  const [rootMenuOpen, setRootMenuOpen] = useState(false)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setRootMenuOpen(true)
  }, [])

  // Check if we're creating a top-level folder (parentPath === '')
  const isCreatingTopFolder = creatingIn?.parentPath === '' && creatingIn.type === 'folder'

  // Pin Inbox at the top; remaining categories keep their original order
  const { inboxCategory, restCategories } = useMemo(() => {
    const inbox = categories.find((c) => c.name === 'inbox') ?? null
    const rest = categories.filter((c) => c.name !== 'inbox')
    return { inboxCategory: inbox, restCategories: rest }
  }, [categories])

  return (
    <ContextMenu open={rootMenuOpen} onOpenChange={setRootMenuOpen}>
      <ContextMenuTrigger>
        <div
          className="flex flex-col shrink-0 bg-[#F7F8FA] min-h-0"
          style={{ width }}
          onContextMenu={handleContextMenu}
        >
          {/* Header bar — height-aligned with the breadcrumb & editor toolbar */}
          <div className="flex items-center gap-2 px-2 py-2.5 border-b border-[#E5E7EB] min-h-[44px] shrink-0">
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="ml-auto flex items-center justify-center size-6 rounded-md text-sidebar-foreground/30 hover:bg-black/5 hover:text-sidebar-foreground/60 transition-colors shrink-0"
                title="Hide categories"
              >
                <PanelLeftClose className="size-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Scrollable category list */}
          <div className="flex flex-col items-stretch gap-0 pt-2 pb-2 px-2 overflow-y-auto sidebar-scrollbar flex-1 min-h-0">
          {/* Inline input for new top-level folder */}
          {isCreatingTopFolder && (
            <NewItemInput
              type="folder"
              depth={0}
              onSubmit={(name) => onCreateSubmit('folder', '', name)}
              onCancel={onCreateCancel}
            />
          )}

          {/* Virtual "Notes" category for root-level files */}
          {rootFilesNode && rootFilesNode.children && rootFilesNode.children.length > 0 && (
            <CategoryItem
              node={rootFilesNode}
              virtualType="root"
              isSelected={selectedCategory === '__root__'}
              onSelect={onCategorySelect}
              isRenaming={false}
              onRenameSubmit={noop}
              onRenameCancel={onRenameCancel}
              onRequestRename={noop}
              onRequestDelete={noop}
              onCreateFolder={noop}
              itemCount={rootFilesNode.children.length}
            />
          )}

          {/* Inbox — pinned to top */}
          {inboxCategory && (
            <CategoryItem
              node={inboxCategory}
              virtualType="inbox"
              isSelected={selectedCategory === inboxCategory.path}
              onSelect={onCategorySelect}
              isRenaming={renamingPath === inboxCategory.path}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onCreateFolder={onCreateFolder}
              itemCount={inboxCategory.children?.length ?? 0}
            />
          )}

          {/* Divider between pinned Inbox and the rest */}
          {inboxCategory && restCategories.length > 0 && (
            <div className="my-1 h-px bg-[#E5E7EB]" />
          )}

          {/* Remaining category folders */}
          {restCategories.map((cat) => (
            <CategoryItem
              key={cat.path}
              node={cat}
              isSelected={selectedCategory === cat.path}
              onSelect={onCategorySelect}
              isRenaming={renamingPath === cat.path}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onCreateFolder={onCreateFolder}
              itemCount={cat.children?.length ?? 0}
            />
          ))}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => { onCreateTopFolder(); setRootMenuOpen(false) }}>
          <FolderPlus className="size-3.5" strokeWidth={1.5} /> New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
