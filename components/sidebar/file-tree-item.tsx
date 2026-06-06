'use client'

import { useState } from 'react'
import { FileText, Folder, FolderOpen, ChevronRight } from 'lucide-react'

import type { FileTreeNode } from '@/types/file-tree'

import { cn } from '@/lib/utils'

interface FileTreeItemProps {
  node: FileTreeNode
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  depth: number
}

export function FileTreeItem({ node, activeFilePath, onFileSelect, depth }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const isActive = activeFilePath === node.path

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="group flex w-full items-center gap-1.5 rounded-md px-2 py-[7px] text-[0.8125rem] text-sidebar-foreground/75 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-sidebar-foreground/30 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
          {isOpen ? (
            <FolderOpen className="size-4 shrink-0 text-sidebar-primary/70" />
          ) : (
            <Folder className="size-4 shrink-0 text-sidebar-foreground/40" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-in-out',
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                activeFilePath={activeFilePath}
                onFileSelect={onFileSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-[7px] text-[0.8125rem] transition-all duration-150',
        isActive
          ? 'bg-sidebar-primary/12 text-sidebar-primary font-medium'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
    >
      <FileText
        className={cn(
          'size-4 shrink-0 transition-colors',
          isActive
            ? 'text-sidebar-primary'
            : 'text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50',
        )}
      />
      <span className="truncate">{node.name}</span>
      {isActive && (
        <span className="ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-primary/50" />
      )}
    </button>
  )
}
