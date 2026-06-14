'use client'

import type { NoteFrontmatter } from '@/types/frontmatter'

interface FrontmatterMetaProps {
  frontmatter: NoteFrontmatter
  onChange: (frontmatter: NoteFrontmatter) => void
}

export function FrontmatterMeta({ frontmatter, onChange }: FrontmatterMetaProps) {
  return (
    <div className="mb-6">
      {/* Title — H1 style */}
      <h1 className="w-full">
        <input
          type="text"
          value={frontmatter.title ?? ''}
          onChange={(e) => onChange({ ...frontmatter, title: e.target.value })}
          placeholder="Untitled"
          className="w-full bg-transparent text-[2rem] font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/30"
        />
      </h1>
      {/* Divider */}
      <hr className="mt-4 border-border/40" />
    </div>
  )
}
