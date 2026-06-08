'use client'

import { memo, useState } from 'react'
import { FileText, Folder, FolderOpen, FolderInput, ChevronRight, FilePlus2, FolderPlus, Pencil, Trash2, Check, PenTool } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'

import type { FileTreeNode } from '@/types/file-tree'

import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { InlineRenameInput } from './inline-rename-input'
import { NewItemInput } from './new-item-input'
import { DeleteConfirmPopover } from './delete-confirm-popover'
import { type FolderOption } from './move-to-picker'

/** Get parent directory of a file path */
function getParentDir(itemPath: string): string {
  const idx = itemPath.lastIndexOf('/')
  return idx === -1 ? '' : itemPath.slice(0, idx)
}

export interface FileTreeItemCallbacks {
  onRequestRename: (path: string) => void
  onRequestDelete: (path: string) => void
  onCreateNote: (parentPath: string) => void
  onCreateFolder: (parentPath: string) => void
  onCreateExcalidraw: (parentPath: string) => void
  onRenameSubmit: (path: string, newName: string) => void
  onRenameCancel: () => void
  onDeleteConfirm: (path: string) => void
  onDeleteCancel: () => void
  onCreateSubmit: (type: 'file' | 'folder' | 'excalidraw', parentPath: string, name: string) => void
  onCreateCancel: () => void
  folders: FolderOption[]
  onMoveTo: (sourcePath: string, targetDir: string) => void
}

interface FileTreeItemProps extends FileTreeItemCallbacks {
  node: FileTreeNode
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  depth: number
  renamingPath: string | null
  deletingPath: string | null
  creatingIn: { parentPath: string; type: 'file' | 'folder' | 'excalidraw' } | null
  onFolderClick?: (path: string) => void
}

export const FileTreeItem = memo(function FileTreeItem({
  node,
  activeFilePath,
  onFileSelect,
  depth,
  renamingPath,
  deletingPath,
  creatingIn,
  onRequestRename,
  onRequestDelete,
  onCreateNote,
  onCreateFolder,
  onCreateExcalidraw,
  onRenameSubmit,
  onRenameCancel,
  onDeleteConfirm,
  onDeleteCancel,
  onCreateSubmit,
  onCreateCancel,
  onFolderClick,
  folders,
  onMoveTo,
}: FileTreeItemProps) {
  const [isOpenUser, setIsOpenUser] = useState(true)

  const isRenaming = renamingPath === node.path
  const isDeleting = deletingPath === node.path
  const isActive = activeFilePath === node.path
  const isFolder = node.type === 'folder'
  const isCreatingHere = creatingIn?.parentPath === node.path
  const isOpen = isCreatingHere || isOpenUser

  const callbacks: FileTreeItemCallbacks = {
    onRequestRename, onRequestDelete, onCreateNote, onCreateFolder, onCreateExcalidraw,
    onRenameSubmit, onRenameCancel, onDeleteConfirm, onDeleteCancel,
    onCreateSubmit, onCreateCancel, folders, onMoveTo,
  }

  const currentFolderPath = getParentDir(node.path)

  // Shared submenu for "Move to…"
  const moveToSubmenu = (
    <ContextMenuPrimitive.SubmenuRoot>
      <ContextMenuPrimitive.SubmenuTrigger
        openOnHover
        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <FolderInput className="size-3.5" strokeWidth={1.5} />
        <span className="flex-1">Move to…</span>
        <span className="ml-auto text-xs opacity-40">▸</span>
      </ContextMenuPrimitive.SubmenuTrigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner
          side="right"
          align="start"
          sideOffset={4}
          className="isolate z-50"
        >
          <ContextMenuPrimitive.Popup
            className="z-50 min-w-[180px] max-h-[320px] overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden sidebar-scrollbar origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {folders.map((folder) => {
              const isCurrent = folder.path === currentFolderPath
              return (
                <ContextMenuPrimitive.Item
                  key={folder.path}
                  disabled={isCurrent}
                  onClick={() => onMoveTo(node.path, folder.path)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden transition-colors',
                    isCurrent
                      ? 'text-[#8a8a8a] cursor-default'
                      : 'cursor-pointer hover:bg-accent hover:text-accent-foreground',
                  )}
                  style={{ paddingLeft: `${folder.depth * 16 + 8}px` }}
                >
                  <Folder className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="truncate flex-1">{folder.name}</span>
                  {isCurrent && <Check className="size-3 shrink-0 text-[#8a8a8a]" strokeWidth={2} />}
                </ContextMenuPrimitive.Item>
              )
            })}
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.SubmenuRoot>
  )

  if (isFolder) {
    const folderButton = (
      <button
        onClick={() => {
          if (onFolderClick) {
            onFolderClick(node.path)
          } else {
            setIsOpenUser((prev) => !prev)
          }
        }}
        className={cn(
          'group flex w-full items-center gap-2 px-3 py-2 text-[0.875rem] text-[#4a4a4a]/60 transition-colors duration-150 hover:text-[#1a1a1a] border-b border-[#e8e6e3]/50 last:border-b-0',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {!onFolderClick && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-[#4a4a4a]/30 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
        )}
        {isOpen ? (
          <FolderOpen className="size-4 shrink-0 text-[#5a5a5a]" strokeWidth={1.5} />
        ) : (
          <Folder className="size-4 shrink-0 text-[#6a6a6a]" strokeWidth={1.5} />
        )}
        {isRenaming ? (
          <InlineRenameInput
            initialName={node.name}
            onSubmit={(newName) => onRenameSubmit(node.path, newName)}
            onCancel={onRenameCancel}
            depth={0}
            className="!ml-0"
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </button>
    )

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>{folderButton}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => { onCreateNote(node.path) }}>
              <FilePlus2 className="size-3.5" strokeWidth={1.5} /> New Note
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { onCreateExcalidraw(node.path) }}>
              <PenTool className="size-3.5" strokeWidth={1.5} /> New Whiteboard
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { onCreateFolder(node.path) }}>
              <FolderPlus className="size-3.5" strokeWidth={1.5} /> New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => { onRequestRename(node.path) }}>
              <Pencil className="size-3.5" strokeWidth={1.5} /> Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => { onRequestDelete(node.path) }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {!onFolderClick && (
          <div className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-in-out',
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}>
            <div className="overflow-hidden">
              {isCreatingHere && creatingIn && (
                <NewItemInput
                  type={creatingIn.type}
                  depth={depth + 1}
                  onSubmit={(name) => onCreateSubmit(creatingIn.type, node.path, name)}
                  onCancel={onCreateCancel}
                />
              )}
              {node.children?.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  activeFilePath={activeFilePath}
                  onFileSelect={onFileSelect}
                  depth={depth + 1}
                  renamingPath={renamingPath}
                  deletingPath={deletingPath}
                  creatingIn={creatingIn}
                  {...callbacks}
                />
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  // File item
  const fileButton = (
    <button
      onClick={() => onFileSelect(node.path)}
      className={cn(
        'group flex w-full items-center gap-2.5 px-3 py-2 text-[0.875rem] transition-all duration-150 border-b border-[#e8e6e3]/50 last:border-b-0',
        isActive
          ? 'text-[#1a1a1a] font-medium bg-transparent'
          : 'text-[#4a4a4a]/60 hover:text-[#1a1a1a] hover:bg-transparent',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {node.name.endsWith('.excalidraw') ? (
        <PenTool
          className={cn(
            'size-3.5 shrink-0 transition-colors',
            isActive ? 'text-[#4a4a4a]' : 'text-[#4a4a4a]/30 group-hover:text-[#4a4a4a]/50',
          )}
          strokeWidth={1.5}
        />
      ) : (
        <FileText
          className={cn(
            'size-3.5 shrink-0 transition-colors',
            isActive ? 'text-[#4a4a4a]' : 'text-[#4a4a4a]/30 group-hover:text-[#4a4a4a]/50',
          )}
          strokeWidth={1.5}
        />
      )}
      {isRenaming ? (
        <InlineRenameInput
          initialName={node.name}
          onSubmit={(newName) => onRenameSubmit(node.path, newName)}
          onCancel={onRenameCancel}
          depth={0}
          className="!ml-0"
        />
      ) : (
        <span className="truncate">{node.name.replace(/\.(md|excalidraw)$/, '')}</span>
      )}
    </button>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          {isDeleting ? (
            <DeleteConfirmPopover
              itemName={node.name}
              onConfirm={() => onDeleteConfirm(node.path)}
              onCancel={onDeleteCancel}
              open={true}
              onOpenChange={(open) => { if (!open) onDeleteCancel() }}
            >
              {fileButton}
            </DeleteConfirmPopover>
          ) : (
            fileButton
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => { onRequestRename(node.path) }}>
            <Pencil className="size-3.5" strokeWidth={1.5} /> Rename
          </ContextMenuItem>
          {moveToSubmenu}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => { onRequestDelete(node.path) }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
})
