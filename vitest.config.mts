import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@spec': path.resolve(root, 'spec'),
      '@drive': path.resolve(root, 'drive'),
      // `server-only` lanza fuera de un bundle de RSC; en tests es un no-op.
      'server-only': path.resolve(root, 'tests/stubs/server-only.ts'),
    },
  },
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/server/**'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
