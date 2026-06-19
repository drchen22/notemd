'use client'

import { memo } from 'react'
import { Check, Folder } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface FolderOption {
  name: string
  path: string
  depth: number
}

interface MoveToPickerProps {
  folders: FolderOption[]
  /** The folder the item currently lives in (marked with ✓, disabled) */
  currentFolderPath: string
  /** Called when user picks a target folder */
  onSelect: (targetDir: string) => void
}

export const MoveToPicker = memo(function MoveToPicker({
  folders,
  currentFolderPath,
  onSelect,
}: MoveToPickerProps) {
  if (folders.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-[#9CA3AF]">
        No folders
      </div>
    )
  }

  return (
    <div className="p-1 min-w-[180px] max-h-[280px] overflow-y-auto sidebar-scrollbar">
      {folders.map((folder) => {
        const isCurrent = folder.path === currentFolderPath
        return (
          <button
            key={folder.path}
            type="button"
            disabled={isCurrent}
            onClick={() => onSelect(folder.path)}
            className={cn(
              'flex items-center gap-2.5 w-full rounded-md py-1.5 pr-2 text-[0.8125rem] transition-colors',
              isCurrent
                ? 'text-[#9CA3AF] cursor-default'
                : 'text-[#374151] hover:bg-[#F3F4F6]',
            )}
            style={{ paddingLeft: `${folder.depth * 16 + 8}px` }}
          >
            <Folder className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate flex-1 text-left">{folder.name}</span>
            {isCurrent && <Check className="size-3 shrink-0 text-[#9CA3AF]" strokeWidth={2} />}
          </button>
        )
      })}
    </div>
  )
})
