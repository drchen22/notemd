'use client'

import { PenLine, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
}

export function EmptyState({
  title = 'AI Writing Assistant',
  description = 'Ask me to summarize, rewrite, translate, or brainstorm ideas for your notes.',
  icon: Icon = PenLine,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-secondary/60">
        <Icon className="size-4 text-muted-foreground/40" strokeWidth={1.5} />
      </div>
      <p className="text-[0.8125rem] font-medium text-foreground/50">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/35 leading-relaxed max-w-[200px]">
        {description}
      </p>
    </div>
  )
}
