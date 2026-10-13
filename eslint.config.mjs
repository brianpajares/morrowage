import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    '.scratch/**',
    'node_modules/**',
    // Paquete de especificación (solo lectura): no se lintéa.
    'spec/**',
    'docs/**',
    'model/**',
    'ux/**',
    'drive/**',
    '01_estrategia/**',
    '02_datos_modelo/**',
    '03_qa_ux/**',
  ]),
  {
    rules: {
      // "TypeScript strict; no `any` no justificado."
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Los logs pasan por src/lib/log.ts (con redacción de PII/health).
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // El único lugar donde se escribe a consola es el logger redactado y los scripts CLI.
    files: ['src/lib/log.ts', 'scripts/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
]);
