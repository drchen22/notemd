'use client'

import { PanelLeftClose } from 'lucide-react'

import type { FileTreeNode } from '@/types/file-tree'

import { CategoryItem } from './category-item'

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
}: CategoryPanelProps) {
  return (
    <div className="flex flex-col items-stretch gap-0 pt-2 pb-2 px-2 overflow-y-auto sidebar-scrollbar shrink-0 bg-[#F8F6F3]"
      style={{ width }}
    >
      {/* Collapse button */}
      {onCollapse && (
        <button
          onClick={onCollapse}
          className="flex items-center justify-center size-6 rounded-md self-end text-sidebar-foreground/30 hover:bg-black/5 hover:text-sidebar-foreground/60 transition-colors mb-2"
          title="Hide categories"
        >
          <PanelLeftClose className="size-4" strokeWidth={1.5} />
        </button>
      )}
      {/* Virtual "Notes" category for root-level files */}
      {rootFilesNode && rootFilesNode.children && rootFilesNode.children.length > 0 && (
        <CategoryItem
          node={rootFilesNode}
          virtualType="root"
          isSelected={selectedCategory === '__root__'}
          onSelect={onCategorySelect}
          isRenaming={false}
          onRenameSubmit={() => {}}
          onRenameCancel={onRenameCancel}
          onRequestRename={() => {}}
          onRequestDelete={() => {}}
          itemCount={rootFilesNode.children.length}
        />
      )}

      {/* Regular category folders */}
      {categories.map((cat) => (
        <CategoryItem
          key={cat.path}
          node={cat}
          virtualType={cat.name === 'inbox' ? 'inbox' : undefined}
          isSelected={selectedCategory === cat.path}
          onSelect={onCategorySelect}
          isRenaming={renamingPath === cat.path}
          onRenameSubmit={(newName) => onRenameSubmit(cat.path, newName)}
          onRenameCancel={onRenameCancel}
          onRequestRename={onRequestRename}
          onRequestDelete={onRequestDelete}
          itemCount={cat.children?.length ?? 0}
        />
      ))}
    </div>
  )
}
