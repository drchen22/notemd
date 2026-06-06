'use client'

import { useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  /** Which side of the handle is the panel being resized (the handle is on the panel's edge) */
  side: 'left' | 'right'
  onResize: (deltaX: number) => void
  className?: string
}

/**
 * A thin draggable strip that sits on the edge of a panel.
 * Reports pixel delta on drag via `onResize`.
 */
export function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragging.current = true
      lastX.current = e.clientX
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      // For left panel: positive delta = wider; for right panel: negative delta = wider
      onResize(side === 'left' ? delta : -delta)
    },
    [onResize, side],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'absolute top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/50',
        side === 'left' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
        className,
      )}
    />
  )
}
