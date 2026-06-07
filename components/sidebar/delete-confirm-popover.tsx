'use client'

import { Trash2 } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DeleteConfirmPopoverProps {
  children: React.ReactNode
  itemName: string
  onConfirm: () => void
  onCancel: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteConfirmPopover({
  children,
  itemName,
  onConfirm,
  onCancel,
  open,
  onOpenChange,
}: DeleteConfirmPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<div />} nativeButton={false}>{children}</PopoverTrigger>
      <PopoverContent side="right" sideOffset={8} align="start" className="w-56">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-3.5" />
            Delete &ldquo;{itemName}&rdquo;?
          </PopoverTitle>
          <PopoverDescription>
            This action cannot be undone.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCancel()
            }}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-7 px-2.5 text-xs',
            )}
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConfirm()
            }}
            className={cn(
              buttonVariants({ variant: 'destructive', size: 'sm' }),
              'h-7 px-2.5 text-xs',
            )}
          >
            Delete
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
