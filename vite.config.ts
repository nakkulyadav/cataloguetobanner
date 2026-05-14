import { defineConfig, loadEnv } from 'vite'
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

/**
 * Dev-only middleware: mirrors functions/api/enhance-image.ts for local dev.
 * Calls HuggingFace swin2SR (same model as the deployed Cloudflare function).
 * Returns the enhanced image as a data URL (no R2 caching in dev).
 */
function enhanceImagePlugin(env: Record<string, string>): Plugin {
  const HF_ESRGAN_ENDPOINT =
    'https://router.huggingface.co/fal-ai/models/caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr'

  return {
    name: 'enhance-image',
    configureServer(server) {
      server.middlewares.use(
        '/api/enhance-image',
        async (req: IncomingMessage, res: ServerResponse) => {
          const setCors = () => {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'content-type')
          }
          if (req.method === 'OPTIONS') { setCors(); res.statusCode = 204; res.end(); return }

          const jsonError = (status: number, error: string, detail?: string) => {
            setCors()
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error, detail: detail ?? null }))
          }

          const rawBody = await new Promise<string>((resolve, reject) => {
            let data = ''
            req.on('data', (chunk: Buffer) => { data += chunk.toString() })
            req.on('end', () => resolve(data))
            req.on('error', reject)
          })

          let body: { imageUrl?: string; imageData?: string; imageMediaType?: string }
          try { body = JSON.parse(rawBody) } catch { return jsonError(400, 'Invalid JSON body') }

          const hfToken = env.HF_TOKEN
          if (!hfToken) return jsonError(500, 'HF_TOKEN not configured in .env')

          if (!body.imageUrl && !body.imageData) {
            return jsonError(400, 'Provide either imageUrl or imageData')
          }

          // Resolve to raw bytes (same as the Cloudflare function)
          let imageBytes: Buffer
          let sourceContentType: string
          if (body.imageUrl) {
            let upstream: Response
            try {
              upstream = await fetch(body.imageUrl)
            } catch (err) {
              return jsonError(502, 'Failed to fetch imageUrl', String(err))
            }
            if (!upstream.ok) return jsonError(502, 'Upstream image fetch failed', `HTTP ${upstream.status}`)
            sourceContentType = upstream.headers.get('content-type') ?? 'image/jpeg'
            imageBytes = Buffer.from(await upstream.arrayBuffer())
          } else {
            sourceContentType = body.imageMediaType ?? 'image/jpeg'
            try {
              imageBytes = Buffer.from(body.imageData!, 'base64')
            } catch {
              return jsonError(400, 'imageData is not valid base64')
            }
          }

          let hfResp: Response
          try {
            hfResp = await fetch(HF_ESRGAN_ENDPOINT, {
              method: 'POST',
              headers: { 'authorization': `Bearer ${hfToken}`, 'content-type': sourceContentType },
              body: imageBytes,
            })
          } catch (err) {
            return jsonError(502, 'Failed to reach HuggingFace Inference API', String(err))
          }

          if (!hfResp.ok) {
            let detail: string
            try {
              const errBody = await hfResp.json() as { error?: string; estimated_time?: number }
              if (hfResp.status === 503 && errBody.estimated_time != null) {
                detail = `Model is loading — estimated wait ${Math.ceil(errBody.estimated_time)}s. Try again shortly.`
              } else {
                detail = errBody.error ?? `HTTP ${hfResp.status}`
              }
            } catch { detail = `HTTP ${hfResp.status}` }
            console.error(`[enhance-image] HuggingFace error ${hfResp.status}: ${detail}`)
            return jsonError(502, 'HuggingFace inference error', detail)
          }

          const enhancedBytes = Buffer.from(await hfResp.arrayBuffer())
          const dataUrl = `data:image/png;base64,${enhancedBytes.toString('base64')}`

          setCors()
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ url: dataUrl, cached: false }))
        },
      )
    },
  }
}

/**
 * Dev-only middleware: mirrors functions/api/generate-image.ts for local dev.
 * Uses CF Workers AI REST API with SD v1.5 img2img.
 * Requires CF_ACCOUNT_ID, CF_API_TOKEN, and a publicly reachable imageUrl.
 */
function generateImagePlugin(env: Record<string, string>): Plugin {
  const CF_IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img'

  return {
    name: 'generate-image',
    configureServer(server) {
      server.middlewares.use(
        '/api/generate-image',
        async (req: IncomingMessage, res: ServerResponse) => {
          const setCorsHeaders = () => {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'content-type')
          }

          if (req.method === 'OPTIONS') {
            setCorsHeaders()
            res.statusCode = 204
            res.end()
            return
          }

          const jsonError = (status: number, error: string, detail?: string) => {
            setCorsHeaders()
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error, detail: detail ?? null }))
          }

          const rawBody = await new Promise<string>((resolve, reject) => {
            let data = ''
            req.on('data', (chunk: Buffer) => { data += chunk.toString() })
            req.on('end', () => resolve(data))
            req.on('error', reject)
          })

          let body: { prompt?: string; imageUrl?: string }
          try { body = JSON.parse(rawBody) } catch { return jsonError(400, 'Invalid JSON body') }

          const { prompt, imageUrl } = body
          if (!prompt) return jsonError(400, 'Missing required field: prompt')
          if (!imageUrl) return jsonError(400, 'Missing required field: imageUrl')

          const accountId = env.CF_ACCOUNT_ID
          const apiToken = env.CF_API_TOKEN
          if (!accountId || !apiToken) {
            return jsonError(500, 'CF_ACCOUNT_ID and CF_API_TOKEN must be set in .env')
          }

          // Fetch the reference image and convert to base64
          let imageBase64: string
          try {
            const imgResp = await fetch(imageUrl)
            if (!imgResp.ok) return jsonError(502, 'Failed to fetch reference image', `HTTP ${imgResp.status}`)
            const buf = Buffer.from(await imgResp.arrayBuffer())
            imageBase64 = buf.toString('base64')
          } catch (err) {
            return jsonError(502, 'Failed to fetch reference image', String(err))
          }

          const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_IMG2IMG_MODEL}`

          let cfResp: Response
          try {
            cfResp = await fetch(cfEndpoint, {
              method: 'POST',
              headers: { 'authorization': `Bearer ${apiToken}`, 'content-type': 'application/json' },
              body: JSON.stringify({ prompt, image: imageBase64, strength: 0.45, guidance: 7.5 }),
            })
          } catch (err) {
            return jsonError(502, 'Failed to reach Cloudflare Workers AI', String(err))
          }

          if (!cfResp.ok) {
            let detail: string
            try {
              const errBody = (await cfResp.json()) as { errors?: { message: string }[] }
              detail = errBody.errors?.[0]?.message ?? `HTTP ${cfResp.status}`
            } catch { detail = `HTTP ${cfResp.status}` }
            console.error(`[generate-image] CF AI error ${cfResp.status}: ${detail}`)
            return jsonError(502, 'Workers AI inference failed', detail)
          }

          const result = (await cfResp.json()) as { result: { image: string } }
          const dataUrl = `data:image/png;base64,${result.result.image}`

          setCorsHeaders()
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ url: dataUrl, cached: false }))
        },
      )
    },
  }
}

/**
 * Dev-only middleware: mirrors functions/api/sheets.ts for local dev.
 * Proxies to Google Visualization API, strips JSONP wrapper, returns clean JSON.
 * No caching in dev.
 */
function sheetsPlugin(): Plugin {
  return {
    name: 'sheets',
    configureServer(server) {
      server.middlewares.use(
        '/api/sheets',
        async (req: IncomingMessage, res: ServerResponse) => {
          const setCorsHeaders = () => {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'content-type')
          }

          if (req.method === 'OPTIONS') {
            setCorsHeaders()
            res.statusCode = 204
            res.end()
            return
          }

          const jsonError = (status: number, error: string, detail?: string) => {
            setCorsHeaders()
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error, detail: detail ?? null }))
          }

          const qs = req.url?.split('?')[1] ?? ''
          const params = new URLSearchParams(qs)
          const sheetId = params.get('sheetId')
          const gid = params.get('gid')

          if (!sheetId) return jsonError(400, 'Missing required query param: sheetId')

          const gvizUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`)
          gvizUrl.searchParams.set('tqx', 'out:json')
          if (gid) gvizUrl.searchParams.set('gid', gid)

          let gvizResp: Response
          try {
            gvizResp = await fetch(gvizUrl.toString())
          } catch (err) {
            return jsonError(502, 'Failed to reach Google Sheets API', String(err))
          }

          if (!gvizResp.ok) return jsonError(502, 'Google Sheets API error', `HTTP ${gvizResp.status}`)

          const rawText = await gvizResp.text()
          const start = rawText.indexOf('(')
          const end = rawText.lastIndexOf(')')
          if (start === -1 || end === -1 || end <= start) {
            return jsonError(502, 'Unexpected Google Sheets response format')
          }
          const jsonText = rawText.slice(start + 1, end)

          try { JSON.parse(jsonText) } catch { return jsonError(502, 'Failed to parse Google Sheets response as JSON') }

          setCorsHeaders()
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(jsonText)
        },
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [react(), imageProxyPlugin(), enhanceImagePlugin(env), generateImagePlugin(env), sheetsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
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
}
})
