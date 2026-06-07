'use client'

import { memo } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ToolbarButtonProps {
  action: () => void
  isActive?: boolean
  icon: LucideIcon
  tooltip?: string
  disabled?: boolean
}

export const ToolbarButton = memo(function ToolbarButton({
  action,
  isActive,
  icon: Icon,
  tooltip,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={action}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'rounded-md text-muted-foreground/50 transition-all duration-150',
        'hover:text-foreground hover:bg-secondary/60',
        'disabled:text-muted-foreground/20',
        isActive && 'bg-secondary/80 text-foreground'
      )}
    >
      <Icon strokeWidth={1.5} className="size-[15px]" />
    </Button>
  )
})
