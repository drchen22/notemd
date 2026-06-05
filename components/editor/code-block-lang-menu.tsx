'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'ini', label: 'INI' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'less', label: 'Less' },
  { value: 'lua', label: 'Lua' },
  { value: 'makefile', label: 'Makefile' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'objectivec', label: 'Objective-C' },
  { value: 'perl', label: 'Perl' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'r', label: 'R' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scss', label: 'SCSS' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
]

// Pre-computed lookup map for O(1) language label resolution
const LANGUAGE_BY_VALUE = new Map(LANGUAGES.map((l) => [l.value, l.label]))

interface CodeBlockLangMenuProps {
  editor: Editor
}

export function CodeBlockLangMenu({ editor }: CodeBlockLangMenuProps) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [currentLang, setCurrentLang] = useState<string>('plaintext')
  const searchRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef<number>(0)

  const updatePosition = useCallback(() => {
    if (!editor) return

    const { $head } = editor.state.selection
    const parentNode = $head.parent

    if (parentNode.type.name !== 'codeBlock') {
      setPosition(null)
      return
    }

    setCurrentLang(parentNode.attrs.language || 'plaintext')

    // Find the <pre> DOM node for the current code block
    const nodeDom = editor.view.nodeDOM($head.before($head.depth))
    let preEl: HTMLElement | null = null
    if (nodeDom instanceof HTMLElement) {
      preEl = nodeDom.querySelector('pre') || (nodeDom.tagName === 'PRE' ? nodeDom : null)
    }

    if (!preEl) {
      setPosition(null)
      return
    }

    const rect = preEl.getBoundingClientRect()
    const scrollContainer = editor.view.dom.closest('.overflow-y-auto')
    const containerRect = scrollContainer?.getBoundingClientRect()

    if (!containerRect) {
      setPosition(null)
      return
    }

    setPosition({
      top: rect.top - containerRect.top + scrollContainer!.scrollTop + 4,
      left: rect.right - containerRect.left - 4,
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const handler = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(updatePosition)
    }

    editor.on('selectionUpdate', handler)
    editor.on('transaction', handler)
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)

    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('transaction', handler)
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
      cancelAnimationFrame(rafRef.current)
    }
  }, [editor, updatePosition])

  if (!position) return null

  const lowerSearch = search.toLowerCase()
  const filtered = LANGUAGES.filter(
    (lang) =>
      lang.label.toLowerCase().includes(lowerSearch) ||
      lang.value.toLowerCase().includes(lowerSearch)
  )

  const currentLabel = LANGUAGE_BY_VALUE.get(currentLang) ?? currentLang

  function selectLanguage(value: string) {
    const { $head } = editor.state.selection
    if ($head.parent.type.name !== 'codeBlock') return
    const pos = $head.before($head.depth)
    editor.chain().setNodeSelection(pos).updateAttributes('codeBlock', { language: value }).run()
    setSearch('')
    editor.commands.focus()
  }

  return (
    <div className="pointer-events-none absolute z-20" style={{ top: position.top, left: position.left }}>
      <Popover>
        <PopoverTrigger
          className="pointer-events-auto rounded-md border border-border bg-background/80 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          {currentLabel}
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-48 p-0">
          <div className="border-b px-2 py-1.5">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search language..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((lang) => (
              <button
                key={lang.value}
                type="button"
                className={`flex w-full items-center rounded-sm px-2 py-1 text-left text-sm ${
                  lang.value === currentLang
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
                onClick={() => selectLanguage(lang.value)}
              >
                {lang.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">No results</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
