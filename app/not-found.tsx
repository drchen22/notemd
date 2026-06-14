import Link from 'next/link'

/**
 * Custom 404 page. Rendered inside the root layout (so providers are
 * available). Kept dependency-free to avoid prerender issues.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <h2 className="text-lg font-semibold text-foreground">页面不存在</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        你访问的页面或文件不存在，可能已被移动或删除。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        返回首页
      </Link>
    </div>
  )
}
