'use client'

import type { NoteFrontmatter } from '@/types/frontmatter'

interface FrontmatterMetaProps {
  frontmatter: NoteFrontmatter
  onChange: (frontmatter: NoteFrontmatter) => void
}

/** Single editable field row: label + text input */
function Field({ label, value, placeholder, onChange }: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground/40 text-xs">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/25 transition-colors hover:bg-secondary/50 focus:bg-secondary/50"
      />
    </div>
  )
}

export function FrontmatterMeta({ frontmatter, onChange }: FrontmatterMetaProps) {
  const update = (patch: Partial<NoteFrontmatter>) => {
    // Remove undefined (empty) values so they don't pollute frontmatter
    const cleaned: NoteFrontmatter = { ...frontmatter }
    for (const [k, v] of Object.entries(patch)) {
      if (v === '') {
        delete cleaned[k]
      } else {
        cleaned[k] = v
      }
    }
    onChange(cleaned)
  }

  return (
    <div className="mb-8 border-b border-border/40 pb-6 space-y-2">
      {/* Title — clean sans-serif, large */}
      <input
        type="text"
        value={frontmatter.title ?? ''}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Untitled"
        className="w-full bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/30"
      />

      {/* Date */}
      <Field
        label="date"
        value={frontmatter.date ?? ''}
        placeholder="YYYY-MM-DD"
        onChange={(v) => update({ date: v })}
      />

      {/* Tags — plain comma-separated text */}
      <Field
        label="tags"
        value={Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : (typeof frontmatter.tags === 'string' ? frontmatter.tags : '')}
        placeholder="tag1, tag2, tag3"
        onChange={(v) => {
          const tags = v.split(',').map((t) => t.trim()).filter(Boolean)
          const cleaned: NoteFrontmatter = { ...frontmatter }
          if (tags.length > 0) {
            cleaned.tags = tags
          } else {
            delete cleaned.tags
          }
          onChange(cleaned)
        }}
      />

      {/* Category */}
      <Field
        label="category"
        value={frontmatter.category ?? ''}
        placeholder="category"
        onChange={(v) => update({ category: v })}
      />
    </div>
  )
}
