import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

// ESLint core's defineConfig replaces the deprecated tseslint.config helper.
export default defineConfig(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'coverage', '.claude', 'src/core/tables/generated.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**/*.{mjs,ts}', '*.config.{js,ts}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/core/**/*.ts'],
    rules: { 'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'performance', 'fetch'] },
  },
)
