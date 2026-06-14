'use client'

import { memo, useState, useCallback } from 'react'
import { Folder, FolderOpen, FileText, Inbox, FolderPlus } from 'lucide-react'

import type { FileTreeNode } from '@/types/file-tree'

import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { InlineRenameInput } from './inline-rename-input'

interface CategoryItemProps {
  node: FileTreeNode
  /** Special virtual node type (e.g. "__root__" for root-level files, "inbox") */
  virtualType?: 'root' | 'inbox'
  isSelected: boolean
  onSelect: (path: string) => void
  isRenaming: boolean
  onRenameSubmit: (path: string, newName: string) => void
  onRenameCancel: () => void
  onRequestRename: (path: string) => void
  onRequestDelete: (path: string) => void
  /** Create a subfolder inside this category */
  onCreateFolder: (parentPath: string) => void
  /** Number of items in this category */
  itemCount?: number
}

export const CategoryItem = memo(function CategoryItem({
  node,
  virtualType,
  isSelected,
  onSelect,
  isRenaming,
  onRenameSubmit,
  onRenameCancel,
  onRequestRename,
  onRequestDelete,
  onCreateFolder,
  itemCount = 0,
}: CategoryItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // No context menu for virtual root category
      if (virtualType === 'root') return
      e.preventDefault()
      setMenuOpen(true)
    },
    [virtualType],
  )

  // Choose icon based on type — darker, more visible
  const icon = virtualType === 'root' ? (
    <FileText className="size-[18px] shrink-0 text-[#5a5a5a]" strokeWidth={1.5} />
  ) : virtualType === 'inbox' ? (
    <Inbox className="size-[18px] shrink-0 text-[#5a5a5a]" strokeWidth={1.5} />
  ) : isSelected ? (
    <FolderOpen className="size-[18px] shrink-0 text-[#4a4a4a]" strokeWidth={1.5} />
  ) : (
    <Folder className="size-[18px] shrink-0 text-[#6a6a6a]" strokeWidth={1.5} />
  )

  return (
    <>
      <button
        onClick={() => onSelect(node.path)}
        onContextMenu={handleContextMenu}
        className={cn(
          'flex items-center gap-3 w-full rounded-lg py-2.5 px-3 transition-colors duration-150 mb-0.5',
          isSelected
            ? 'text-[#1a1a1a] bg-black/[0.06]'
            : 'text-[#4a4a4a] hover:bg-black/[0.04]',
        )}
        title={node.name}
      >
        {icon}
        <span className="text-[0.9375rem] leading-tight truncate flex-1 text-left font-medium">
          {isRenaming ? null : node.name}
        </span>
        {itemCount > 0 && (
          <span className={cn(
            'text-[0.75rem] font-medium tabular-nums shrink-0',
            isSelected ? 'text-[#1a1a1a]/70' : 'text-[#4a4a4a]/50'
          )}>
            {itemCount}
          </span>
        )}
        {isRenaming && (
          <InlineRenameInput
            initialName={node.name}
            onSubmit={(newName) => onRenameSubmit(node.path, newName)}
            onCancel={onRenameCancel}
            depth={0}
            className="!ml-0 text-center"
          />
        )}
      </button>

      {/* Context menu for categories (not virtual root) */}
      {!virtualType && (
        <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => { onCreateFolder(node.path); setMenuOpen(false) }}>
              <FolderPlus className="size-3.5" strokeWidth={1.5} /> New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => { onRequestRename(node.path); setMenuOpen(false) }}>
              Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => { onRequestDelete(node.path); setMenuOpen(false) }}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </>
  )
})
