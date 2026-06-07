'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import {
  Code2,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  TextQuote,
  Trash2,
  Type,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ─── Types ──────────────────────────────────────────────────────

type BlockType =
  | 'paragraph'
  | 'heading1' | 'heading2' | 'heading3'
  | 'bulletList' | 'orderedList' | 'taskList'
  | 'blockquote' | 'codeBlock'

interface HandleBlock {
  node: PMNode
  depth: number
  pos: number
  parentTypeName?: string
  isInBlockquote: boolean
}

interface BlockInfo extends HandleBlock {
  domElement: HTMLElement
}

// ─── Constants ──────────────────────────────────────────────────

const BLOCK_TYPES: { id: BlockType; label: string; icon: typeof Type }[] = [
  { id: 'paragraph', label: 'Text', icon: Type },
  { id: 'heading1', label: 'Heading 1', icon: Heading1 },
  { id: 'heading2', label: 'Heading 2', icon: Heading2 },
  { id: 'heading3', label: 'Heading 3', icon: Heading3 },
  { id: 'bulletList', label: 'Bullet List', icon: List },
  { id: 'orderedList', label: 'Ordered List', icon: ListOrdered },
  { id: 'taskList', label: 'Task List', icon: ListChecks },
  { id: 'blockquote', label: 'Blockquote', icon: TextQuote },
  { id: 'codeBlock', label: 'Code Block', icon: Code2 },
]

const TABLE_TYPES = new Set(['table', 'tableRow', 'tableCell', 'tableHeader'])
const LIST_CONTAINER_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])
const LIST_ITEM_TYPES = new Set(['listItem', 'taskItem'])
const CONTENT_TYPES = new Set(['paragraph', 'heading', 'codeBlock'])

// ─── Helpers ────────────────────────────────────────────────────

/** Walk up from the cursor position to find the handleable block. */
function getHandleBlock($pos: ResolvedPos): HandleBlock | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    const name = node.type.name

    // Skip container nodes — their children get handles
    if (LIST_CONTAINER_TYPES.has(name)) continue
    if (name === 'doc') continue
    // No handles inside tables or images
    if (TABLE_TYPES.has(name) || name === 'image') return null

    // Content nodes inside list items are not blocks — the list item is
    if (d > 1) {
      const parent = $pos.node(d - 1)
      if (LIST_ITEM_TYPES.has(parent.type.name) && CONTENT_TYPES.has(name)) {
        continue
      }
    }

    // Check blockquote ancestry (for paragraphs inside blockquotes)
    let isInBlockquote = false
    if (name !== 'blockquote') {
      for (let a = d - 1; a > 0; a--) {
        if ($pos.node(a).type.name === 'blockquote') {
          isInBlockquote = true
          break
        }
      }
    }

    const parentTypeName = d > 1 ? $pos.node(d - 1).type.name : undefined
    return { node, depth: d, pos: $pos.before(d), parentTypeName, isInBlockquote }
  }

  return null
}

/** Detect the perceived block type for menu highlighting. */
function detectBlockType(block: HandleBlock): BlockType {
  const name = block.node.type.name

  if (name === 'heading') return `heading${block.node.attrs.level}` as BlockType
  if (name === 'codeBlock') return 'codeBlock'
  if (name === 'blockquote') return 'blockquote'
  if (name === 'taskItem') return 'taskList'
  if (name === 'listItem') {
    return block.parentTypeName === 'orderedList' ? 'orderedList' : 'bulletList'
  }
  if (block.isInBlockquote) return 'blockquote'
  return 'paragraph'
}

/** Convert the block at the given position to the target type. */
function convertBlock(editor: Editor, block: HandleBlock, targetId: BlockType) {
  const currentType = detectBlockType(block)
  if (currentType === targetId) return

  const chain = editor.chain().focus().setTextSelection(block.pos + 1)

  // First unwrap from current container
  if (currentType === 'bulletList') chain.toggleBulletList()
  else if (currentType === 'orderedList') chain.toggleOrderedList()
  else if (currentType === 'taskList') chain.toggleTaskList()
  else if (currentType === 'blockquote') chain.toggleBlockquote()
  else if (currentType === 'codeBlock') chain.toggleCodeBlock()

  // Then apply the target type
  switch (targetId) {
    case 'paragraph': chain.setParagraph(); break
    case 'heading1': chain.toggleHeading({ level: 1 }); break
    case 'heading2': chain.toggleHeading({ level: 2 }); break
    case 'heading3': chain.toggleHeading({ level: 3 }); break
    case 'bulletList': chain.toggleBulletList(); break
    case 'orderedList': chain.toggleOrderedList(); break
    case 'taskList': chain.toggleTaskList(); break
    case 'blockquote': chain.toggleBlockquote(); break
    case 'codeBlock': chain.toggleCodeBlock(); break
  }

  chain.run()
}

/** Delete the block at the given position. */
function deleteBlock(editor: Editor, block: HandleBlock) {
  editor.chain()
    .focus()
    .deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
    .run()
}

// ─── Component ──────────────────────────────────────────────────

interface BlockHandleProps {
  editor: Editor
}

export function BlockHandle({ editor }: BlockHandleProps) {
  const [hoveredBlock, setHoveredBlock] = useState<BlockInfo | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const menuOpenRef = useRef(false)
  useEffect(() => { menuOpenRef.current = menuOpen })

  const handleRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const blockRef = useRef<HandleBlock | null>(null)

  // ── Position computation ──────────────────────────────────────

  const updatePosition = useCallback(() => {
    const block = hoveredBlock
    if (!block) { setPosition(null); return }

    const el = block.domElement
    if (!el.isConnected) { setPosition(null); return }

    const scrollContainer = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
    if (!scrollContainer) { setPosition(null); return }

    const rect = el.getBoundingClientRect()
    const containerRect = scrollContainer.getBoundingClientRect()

    // Use the .tiptap element's left edge so the handle stays aligned
    // regardless of block indentation (lists, blockquotes, etc.)
    const contentLeft = editor.view.dom.getBoundingClientRect().left

    setPosition({
      top: rect.top - containerRect.top + scrollContainer.scrollTop + 4,
      left: contentLeft - containerRect.left - 28,
    })
  }, [editor, hoveredBlock])

  // ── Mouse tracking ────────────────────────────────────────────

  useEffect(() => {
    const scrollContainer = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
    if (!scrollContainer) return

    const onMouseMove = (e: MouseEvent) => {
      if (menuOpenRef.current) return
      // Don't update when mouse is over the handle/menu
      if (handleRef.current?.contains(e.target as Node)) return

      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
        if (!coords) return // keep current block (gap between blocks)

        const $pos = editor.state.doc.resolve(coords.pos)
        const block = getHandleBlock($pos)
        if (!block) return // keep current block (might be table/image)

        // Skip if same block (avoid unnecessary re-renders)
        if (blockRef.current?.pos === block.pos) return

        const domNode = editor.view.nodeDOM(block.pos) as HTMLElement | null
        if (!domNode) return

        blockRef.current = block
        setHoveredBlock({ ...block, domElement: domNode })
      })
    }

    const onMouseLeave = () => {
      if (!menuOpenRef.current) {
        setHoveredBlock(null)
        blockRef.current = null
      }
    }

    scrollContainer.addEventListener('mousemove', onMouseMove)
    scrollContainer.addEventListener('mouseleave', onMouseLeave)

    return () => {
      scrollContainer.removeEventListener('mousemove', onMouseMove)
      scrollContainer.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [editor])

  // ── Position updates on scroll / resize / transaction ─────────

  useEffect(() => {
    if (!hoveredBlock) return

    const handler = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(updatePosition)
    }

    editor.on('transaction', handler)
    editor.on('selectionUpdate', handler)
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, { passive: true, capture: true })

    return () => {
      editor.off('transaction', handler)
      editor.off('selectionUpdate', handler)
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
      cancelAnimationFrame(rafRef.current)
    }
  }, [editor, hoveredBlock, updatePosition])

  // Recompute when block reference changes
  useEffect(() => {
    const raf = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(raf)
  }, [updatePosition])

  // ── Render ────────────────────────────────────────────────────

  if (!hoveredBlock || !position) return null

  const currentType = detectBlockType(hoveredBlock)

  return (
    <div
      ref={handleRef}
      className="pointer-events-none absolute z-20"
      style={{ top: position.top, left: position.left }}
    >
      <Popover
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          menuOpenRef.current = open
        }}
      >
        <PopoverTrigger className="block-handle pointer-events-auto flex items-center justify-center rounded-md">
          <GripVertical size={14} strokeWidth={2.5} />
        </PopoverTrigger>
        <PopoverContent align="start" side="right" sideOffset={4} className="w-52 p-1">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Turn into
          </div>
          {BLOCK_TYPES.map((bt) => {
            const active = bt.id === currentType
            return (
              <button
                key={bt.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-foreground hover:bg-accent/5'
                }`}
                onClick={() => {
                  if (blockRef.current) {
                    convertBlock(editor, blockRef.current, bt.id)
                  }
                  setMenuOpen(false)
                  menuOpenRef.current = false
                }}
              >
                <bt.icon size={15} className={active ? 'text-accent' : 'text-muted-foreground'} />
                {bt.label}
              </button>
            )
          })}
          <div className="my-1 border-t border-border/60" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-destructive transition-colors hover:bg-destructive/5"
            onClick={() => {
              if (blockRef.current) {
                deleteBlock(editor, blockRef.current)
              }
              setMenuOpen(false)
              menuOpenRef.current = false
              setHoveredBlock(null)
              blockRef.current = null
            }}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
