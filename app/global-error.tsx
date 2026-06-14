'use client'

import { useEffect } from 'react'

/**
 * Global error boundary. Replaces the root layout entirely when it throws,
 * so it must render its own <html>/<body> and must NOT depend on any context
 * provider or library that reads context (it runs outside the provider tree).
 * Uses inline SVG only — no icon library — to stay self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error-boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '32px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f5f5f4',
          color: '#1c1917',
        }}
      >
        {/* Inline warning triangle SVG — no icon library dependency */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>
            应用发生严重错误
          </h2>
          <p style={{ margin: 0, maxWidth: '400px', fontSize: '14px', color: '#78716c' }}>
            重新加载页面通常可以恢复。如果问题持续，请检查服务是否正常运行。
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#fafaf9',
            backgroundColor: '#1c1917',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          重试
        </button>
      </body>
    </html>
  )
}
