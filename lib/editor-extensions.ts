import { mergeAttributes, ResizableNodeView } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from '@tiptap/markdown'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

const ResizableImage = Image.extend({
  renderMarkdown: (node) => {
    const src = node.attrs?.src ?? ''
    const alt = node.attrs?.alt ?? ''
    const width = node.attrs?.width
    const height = node.attrs?.height

    // If dimensions are set, use HTML <img> tag for portability
    if (width || height) {
      let tag = `<img src="${src}"`
      if (alt) tag += ` alt="${alt}"`
      if (width) tag += ` width="${width}"`
      if (height) tag += ` height="${height}"`
      tag += '>'
      return tag
    }

    // No dimensions — use standard markdown
    const title = node.attrs?.title
    if (title) return `![${alt}](${src} "${title}")`
    return `![${alt}](${src})`
  },

  addNodeView() {
    const resizeOpts = this.options.resize
    if (!resizeOpts || typeof resizeOpts === 'boolean' || !resizeOpts.enabled || typeof document === 'undefined') {
      return null
    }

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement('img')
      el.draggable = false

      const mergedAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
      Object.entries(mergedAttributes).forEach(([key, value]) => {
        if (value != null) {
          switch (key) {
            case 'width':
            case 'height':
              break
            default:
              el.setAttribute(key, value)
              break
          }
        }
      })
      if (mergedAttributes.src !== null) {
        el.src = mergedAttributes.src
      }

      // Compute max width from the editor's content container
      const editorContent = editor.view.dom.parentElement
      const maxContainerWidth = editorContent ? editorContent.clientWidth : 800

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`
          el.style.height = `${height}px`
        },
        onCommit: (width, height) => {
          const pos = getPos()
          if (pos === undefined) return
          this.editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes(this.name, { width, height })
            .run()
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type) return false
          return true
        },
        options: {
          directions: resizeOpts.directions,
          min: {
            width: resizeOpts.minWidth ?? 50,
            height: 50,
          },
          max: {
            width: maxContainerWidth,
          },
          preserveAspectRatio: resizeOpts.alwaysPreserveAspectRatio ?? true,
        },
      })

      const dom = nodeView.dom
      dom.style.visibility = 'hidden'
      dom.style.pointerEvents = 'none'
      el.onload = () => {
        dom.style.visibility = ''
        dom.style.pointerEvents = ''
      }

      return nodeView
    }
  },
}).configure({
  inline: false,
  allowBase64: false,
  resize: {
    enabled: true,
    directions: ['left', 'right'],
    minWidth: 50,
    alwaysPreserveAspectRatio: true,
  },
  HTMLAttributes: {
    class: 'tiptap-image',
  },
})

export const editorExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
    codeBlock: false,
  }),
  Placeholder.configure({
    placeholder: 'Start writing, or type # for a heading...',
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
  }),
  ResizableImage,
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Markdown,
]
