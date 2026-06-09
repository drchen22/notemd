'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { HardDrive, Settings, Trash2, AlertTriangle, Check, FileText, PenTool, Image } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrphanAttachment {
  path: string
  size: number
  lastModified: string
}

interface StorageAnalysis {
  totalSize: number
  categories: {
    markdown: { count: number; size: number }
    excalidraw: { count: number; size: number }
    images: { count: number; size: number }
  }
  folders: Array<{
    name: string
    path: string
    size: number
    fileCount: number
    breakdown: { markdown: number; excalidraw: number; images: number }
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function pct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// ---------------------------------------------------------------------------
// Settings Dialog
// ---------------------------------------------------------------------------

export function SettingsDialog() {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.875rem] text-[#4a4a4a]/60 transition-colors hover:bg-black/[0.04] hover:text-[#1a1a1a]"
      >
        <Settings className="size-[15px] shrink-0" strokeWidth={1.5} />
        <span>设置</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/40 z-50 transition-opacity animate-in fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[80vh] bg-white rounded-xl shadow-xl ring-1 ring-foreground/10 outline-none overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e6e3]">
            <DialogPrimitive.Title className="text-base font-semibold text-[#1a1a1a]">
              设置
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="text-[#8a8a8a] hover:text-[#1a1a1a] transition-colors text-lg leading-none">
              ✕
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <StorageOverview />
            <StorageSection />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// Storage Overview — space visualization
// ---------------------------------------------------------------------------

const CATEGORY_META = [
  {
    key: 'markdown' as const,
    label: 'Markdown',
    icon: FileText,
    color: 'bg-blue-500',
    trackColor: 'bg-blue-100',
  },
  {
    key: 'excalidraw' as const,
    label: '白板',
    icon: PenTool,
    color: 'bg-purple-500',
    trackColor: 'bg-purple-100',
  },
  {
    key: 'images' as const,
    label: '图片',
    icon: Image,
    color: 'bg-amber-500',
    trackColor: 'bg-amber-100',
  },
]

function StorageOverview() {
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStorage = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/attachments?action=storage')
      if (res.ok) {
        setAnalysis(await res.json())
      }
    } catch {
      // silently fail — storage info is non-critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStorage()
  }, [loadStorage])

  if (isLoading && !analysis) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="size-4 text-[#4a4a4a]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[#1a1a1a]">空间使用</h3>
        </div>
        <div className="text-xs text-[#8a8a8a] py-4 text-center">扫描中…</div>
      </div>
    )
  }

  if (!analysis) return null

  const total = analysis.totalSize

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-[#4a4a4a]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[#1a1a1a]">空间使用</h3>
        </div>
        <button
          onClick={loadStorage}
          disabled={isLoading}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'xs' }),
            'text-xs',
          )}
        >
          刷新
        </button>
      </div>

      {/* Total size */}
      <div className="text-2xl font-bold text-[#1a1a1a] mb-3">
        {formatSize(total)}
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-[#f0f0ee] mb-4">
        {CATEGORY_META.map((cat) => {
          const size = analysis.categories[cat.key].size
          if (size === 0) return null
          return (
            <div
              key={cat.key}
              className={cn(cat.color, 'transition-all duration-300')}
              style={{ width: `${pct(size, total)}%` }}
            />
          )
        })}
      </div>

      {/* Category legend */}
      <div className="space-y-2 mb-5">
        {CATEGORY_META.map((cat) => {
          const { count, size } = analysis.categories[cat.key]
          const percent = pct(size, total)
          const Icon = cat.icon
          return (
            <div key={cat.key} className="flex items-center gap-2.5">
              <div className={cn('size-2 rounded-full shrink-0', cat.color)} />
              <Icon className="size-3.5 text-[#8a8a8a] shrink-0" strokeWidth={1.5} />
              <span className="text-xs text-[#4a4a4a] flex-1">
                {cat.label}
              </span>
              <span className="text-xs text-[#8a8a8a] tabular-nums">
                {count > 0 ? `${count} 个文件` : '—'}
              </span>
              <span className="text-xs font-medium text-[#1a1a1a] tabular-nums w-16 text-right">
                {size > 0 ? formatSize(size) : '—'}
              </span>
              <span className="text-[0.65rem] text-[#8a8a8a] w-8 text-right tabular-nums">
                {size > 0 ? `${percent}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Per-folder breakdown */}
      {analysis.folders.length > 0 && (
        <div>
          <div className="text-xs text-[#8a8a8a] mb-2">按文件夹</div>
          <div className="space-y-1.5">
            {analysis.folders.map((folder) => {
              const folderPercent = pct(folder.size, total)
              return (
                <div key={folder.path || '/'} className="group">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-[#1a1a1a] font-medium truncate flex-1">
                      {folder.name}/
                    </span>
                    <span className="text-[0.65rem] text-[#8a8a8a] tabular-nums">
                      {folder.fileCount} 个文件
                    </span>
                    <span className="text-xs font-medium text-[#1a1a1a] tabular-nums w-14 text-right">
                      {formatSize(folder.size)}
                    </span>
                  </div>
                  {/* Mini stacked bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-[#f0f0ee]">
                    {CATEGORY_META.map((cat) => {
                      const size = folder.breakdown[cat.key]
                      if (size === 0) return null
                      return (
                        <div
                          key={cat.key}
                          className={cn(cat.color, 'transition-all duration-300')}
                          style={{ width: `${pct(size, folder.size)}%` }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Storage Section — orphan cleanup (existing)
// ---------------------------------------------------------------------------

function StorageSection() {
  const [orphans, setOrphans] = useState<OrphanAttachment[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrphans = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/attachments?action=orphans')
      if (res.ok) {
        const data = await res.json()
        setOrphans(data.orphans)
        setTotalSize(data.totalSize)
        setSelected(new Set())
      } else {
        setError('扫描失败')
      }
    } catch {
      setError('扫描失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-load when component mounts
  useEffect(() => {
    loadOrphans()
  }, [loadOrphans])

  const toggleSelect = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selected.size === orphans.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orphans.map((o) => o.path)))
    }
  }, [selected.size, orphans])

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: Array.from(selected) }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.failed?.length > 0) {
          setError(`${data.failed.length} 个文件删除失败`)
        }
        // Reload to refresh the list
        await loadOrphans()
      } else {
        setError('删除失败')
      }
    } catch {
      setError('删除失败')
    } finally {
      setIsDeleting(false)
    }
  }, [selected, loadOrphans])

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pt-5 border-t border-[#e8e6e3]">
        <Trash2 className="size-4 text-[#4a4a4a]" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-[#1a1a1a]">孤立附件</h3>
      </div>

      <p className="text-xs text-[#8a8a8a] mb-3">
        检测未被任何文档引用的附件文件，释放磁盘空间。
      </p>

      {/* Summary */}
      <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-[#F8F6F3] rounded-lg">
        <div className="flex-1">
          <div className="text-xs text-[#8a8a8a]">孤立附件</div>
          <div className="text-sm font-medium text-[#1a1a1a]">
            {isLoading ? '扫描中…' : `${orphans.length} 个文件，共 ${formatSize(totalSize)}`}
          </div>
        </div>
        <button
          onClick={loadOrphans}
          disabled={isLoading}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'text-xs',
          )}
        >
          重新扫描
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-destructive/10 rounded-lg text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Orphan list */}
      {orphans.length > 0 ? (
        <div className="border border-[#e8e6e3] rounded-lg overflow-hidden">
          {/* Select all header */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-[#fafaf9] border-b border-[#e8e6e3]">
            <button
              onClick={toggleSelectAll}
              className="flex items-center justify-center size-4 rounded border border-[#c8c6c3] bg-white shrink-0"
            >
              {selected.size === orphans.length && (
                <Check className="size-3 text-[#1a1a1a]" strokeWidth={2} />
              )}
            </button>
            <span className="text-xs text-[#8a8a8a]">
              全选 ({selected.size}/{orphans.length})
            </span>
            {selected.size > 0 && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  buttonVariants({ variant: 'destructive', size: 'xs' }),
                  'ml-auto text-xs',
                )}
              >
                <Trash2 className="size-3" />
                {isDeleting ? '删除中…' : `删除选中 (${selected.size})`}
              </button>
            )}
          </div>

          {/* File list */}
          <div className="max-h-[300px] overflow-y-auto">
            {orphans.map((orphan) => (
              <OrphanRow
                key={orphan.path}
                orphan={orphan}
                isSelected={selected.has(orphan.path)}
                onToggle={() => toggleSelect(orphan.path)}
              />
            ))}
          </div>
        </div>
      ) : !isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-[#8a8a8a]">
          没有发现孤立附件 ✨
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orphan Row
// ---------------------------------------------------------------------------

function OrphanRow({
  orphan,
  isSelected,
  onToggle,
}: {
  orphan: OrphanAttachment
  isSelected: boolean
  onToggle: () => void
}) {
  const filename = orphan.path.split('/').pop() ?? orphan.path
  const parentDir = orphan.path.replace(/\/assets\/.*$/, '')

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b border-[#f0f0ee] last:border-b-0 hover:bg-[#fafaf9] transition-colors"
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center size-4 rounded border border-[#c8c6c3] bg-white shrink-0"
      >
        {isSelected && (
          <Check className="size-3 text-[#1a1a1a]" strokeWidth={2} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#1a1a1a] truncate font-mono">
          {filename}
        </div>
        <div className="text-[0.65rem] text-[#8a8a8a] truncate">
          {parentDir}
        </div>
      </div>
      <span className="text-[0.65rem] text-[#8a8a8a] shrink-0">
        {formatSize(orphan.size)}
      </span>
    </div>
  )
}
