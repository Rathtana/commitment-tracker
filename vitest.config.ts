import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Mirror the tsconfig.json `@/*` → `./src/*` path alias so tests can import
  // server-action / library code using the same module specifiers as app code.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/lib/**/*.ts'],
    },
  },
})
