import { defineConfig } from 'vitest/config'
import type { Connect } from 'vite'
import { fileURLToPath } from 'node:url'

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)

/** Serve /lab (and /lab?...) from lab.html, as vercel.json does in production. */
const labRewrite: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/lab' || req.url?.startsWith('/lab?')) req.url = req.url.replace('/lab', '/lab.html')
  next()
}

export default defineConfig({
  // Vite 8 transforms with Oxc; the old `esbuild` option is deprecated.
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    // Vite 8 bundles with Rolldown; `rollupOptions` is the deprecated alias.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab.html', import.meta.url)),
      },
    },
  },
  plugins: [
    {
      name: 'lab-route',
      configureServer(server) {
        server.middlewares.use(labRewrite)
      },
      configurePreviewServer(server) {
        server.middlewares.use(labRewrite)
      },
    },
  ],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
})
