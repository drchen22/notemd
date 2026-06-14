'use client'

import dynamic from 'next/dynamic'

// Client wrapper so the root layout (a server component) can mount the
// Toaster with ssr:false — avoids touching sonner's internal context during
// static prerender of /_not-found and /_global-error.
const Toaster = dynamic(() => import('sonner').then((m) => m.Toaster), {
  ssr: false,
})

export function ClientToaster() {
  return <Toaster position="bottom-center" richColors closeButton />
}
