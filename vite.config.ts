import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)

export default defineConfig({
  // Vite 8 transforms with Oxc; the old `esbuild` option is deprecated.
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    rollupOptions: {
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
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/lab' || req.url?.startsWith('/lab?')) req.url = req.url.replace('/lab', '/lab.html')
          next()
        })
      },
    },
  ],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
})
