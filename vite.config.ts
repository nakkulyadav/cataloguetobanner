import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Dev-only middleware: proxies /api/image?url=<encoded> to the remote URL
 * server-side, bypassing the browser CORS restriction on cross-origin images.
 * In production the same /api/image route is handled by the serverless function.
 */
function imageProxyPlugin(): Plugin {
  return {
    name: 'image-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/image',
        async (req: IncomingMessage, res: ServerResponse) => {
          const qs = req.url?.split('?')[1] ?? ''
          const params = new URLSearchParams(qs)
          const remoteUrl = params.get('url')

          if (!remoteUrl) {
            res.statusCode = 400
            res.end('Missing url param')
            return
          }

          try {
            const upstream = await fetch(remoteUrl)
            if (!upstream.ok) {
              res.statusCode = upstream.status
              res.end(`Upstream error: ${upstream.status}`)
              return
            }
            const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            const buffer = await upstream.arrayBuffer()
            res.end(Buffer.from(buffer))
          } catch (err) {
            res.statusCode = 502
            res.end(`Proxy fetch failed: ${String(err)}`)
          }
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), imageProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/catalog': {
        target: 'https://prod.digihaat.in/analyticsDashboard/catalog',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/catalog/, ''),
      },
    },
  },
  // Bundle Web Workers as ES modules so that dynamic imports inside the
  // @imgly/background-removal package (WASM loading, model fetch) work
  // correctly in the worker context.
  worker: {
    format: 'es',
  },
  // Exclude @imgly/background-removal from Vite's pre-bundling step.
  // The package relies on dynamic import() for WASM and model files that
  // Vite's dep optimizer cannot handle statically — leaving it as a native
  // ES module import avoids transform errors at build time and in the worker.
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
})
