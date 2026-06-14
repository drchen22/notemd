'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Route-segment error boundary. Catches runtime errors in the page while
 * keeping the root layout (sidebar, providers) mounted. Receives `reset`
 * to attempt re-render after the user dismisses the error.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <AlertTriangle className="size-10 text-destructive" strokeWidth={1.5} />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">出错了</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          页面遇到了意外错误。可以重试，或刷新页面。
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        <RotateCcw className="size-4" strokeWidth={1.5} />
        重试
      </button>
    </div>
  )
}
