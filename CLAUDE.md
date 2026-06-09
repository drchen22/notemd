<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

# NoteMD — Web Typora-like Markdown Editor

A web-based markdown editor with AI features, inspired by Typora.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Editor**: Tiptap (MIT open-source core, headless)
- **AI**: Vercel AI SDK + custom LLM API (OpenAI/Anthropic/local)
- **Markdown**: @tiptap/pm/markdown (bidirectional parse & serialize)

## Project Structure

- `app/` — Next.js App Router pages and layouts
- `public/` — Static assets

## Key Decisions

- Tiptap headless: no built-in UI, all editor UI is custom-built with shadcn/ui
- AI features are self-implemented via Vercel AI SDK (not using Tiptap's paid Pro extensions)
- No collaboration features needed (single-user editor)
- Markdown is the primary document format

## Development

```bash
pnpm dev       # Start dev server
pnpm build     # Production build
pnpm lint      # Run ESLint
```
