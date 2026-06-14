import { defineConfig } from 'vitest/config'

// Only `lib/` pure functions are tested (fs/path/crypto, no React),
// so we use the `node` environment instead of jsdom.
// Vite resolves the `@/*` alias from tsconfig.json natively.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    // Tests live under __tests__/ next to the modules they cover.
    include: ['**/__tests__/**/*.test.ts'],
  },
})
