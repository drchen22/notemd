'use client'

import { memo } from 'react'
import { FileText, FolderInput, Trash2, Folder, Check, PenTool } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'

import type { FileTreeNode } from '@/types/file-tree'

import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DeleteConfirmPopover } from './delete-confirm-popover'
import { type FolderOption } from './move-to-picker'

/** Format a date string (YYYY-MM-DD) into a human-readable format */
function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/** Strip known extension from filename */
function stripExt(name: string): string {
  return name.replace(/\.(md|excalidraw)$/, '')
}

/** Get parent directory of a file path */
function getParentDir(itemPath: string): string {
  const idx = itemPath.lastIndexOf('/')
  return idx === -1 ? '' : itemPath.slice(0, idx)
}

interface NoteCardProps {
  node: FileTreeNode
  isActive: boolean
  onSelect: (path: string) => void
  onRequestDelete: (path: string) => void
  onDeleteConfirm: (path: string) => void
  onDeleteCancel: () => void
  isDeleting: boolean
  folders: FolderOption[]
  onMoveTo: (sourcePath: string, targetDir: string) => void
}

export const NoteCard = memo(function NoteCard({
  node,
  isActive,
  onSelect,
  onRequestDelete,
  onDeleteConfirm,
  onDeleteCancel,
  isDeleting,
  folders,
  onMoveTo,
}: NoteCardProps) {
  const title = node.frontmatter?.title || stripExt(node.name)
  const dateStr = node.frontmatter?.date
  const formattedDate = formatDate(dateStr)
  const preview = node.preview
  const currentFolderPath = getParentDir(node.path)

  const card = (
    <div
      onClick={() => onSelect(node.path)}
      className={cn(
        'group relative px-4 py-3.5 cursor-pointer transition-colors duration-150 border-b border-[#e8e6e3] last:border-b-0',
        isActive
          ? 'bg-[#f5f5f4]'
          : 'hover:bg-[#fafaf9]',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8a8a8a] rounded-r-full" />
      )}

      <div className="flex items-start gap-3 mb-2">
        {node.name.endsWith('.excalidraw') ? (
          <PenTool
            className={cn(
              'size-[15px] shrink-0 mt-1',
              isActive ? 'text-[#4a4a4a]/70' : 'text-[#4a4a4a]/30 group-hover:text-[#4a4a4a]/50',
            )}
            strokeWidth={1.5}
          />
        ) : (
          <FileText
            className={cn(
              'size-[15px] shrink-0 mt-1',
              isActive ? 'text-[#4a4a4a]/70' : 'text-[#4a4a4a]/30 group-hover:text-[#4a4a4a]/50',
            )}
            strokeWidth={1.5}
          />
        )}
        <span
          className={cn(
            'text-[0.9375rem] flex-1 font-medium',
            isActive ? 'text-[#1a1a1a]' : 'text-[#3a3a3a]',
          )}
        >
          {title}
        </span>
      </div>

      {preview && (
        <p className="text-[0.8125rem] text-[#6a6a6a] leading-relaxed line-clamp-2 pl-[27px] mb-2">
          {preview}
        </p>
      )}

      {formattedDate && (
        <div className="flex items-center justify-between pl-[27px]">
          <span className="text-[0.75rem] text-[#8a8a8a]">{formattedDate}</span>
          <span className="text-[0.75rem] text-[#8a8a8a]">Created {formattedDate}</span>
        </div>
      )}
    </div>
  )

  return (
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
            {card}
          </DeleteConfirmPopover>
        ) : (
          card
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {/* Move to — hover submenu */}
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

        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => { onRequestDelete(node.path) }}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
