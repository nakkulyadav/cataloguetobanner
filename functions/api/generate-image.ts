import { hashKey, getFromR2, storeInR2, r2PublicUrl, type Env } from '../lib/r2Storage'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img'

// Low strength preserves product shape/label/colour; only lighting + quality improves
const DEFAULT_STRENGTH = 0.45
const DEFAULT_GUIDANCE = 7.5

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail: detail ?? null }), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch image (HTTP ${resp.status}): ${url}`)
  const buffer = await resp.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function onRequestPost(context: {
  request: Request
  env: Env
}): Promise<Response> {
  let body: { prompt?: string; imageUrl?: string }
  try {
    body = await context.request.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const { prompt, imageUrl } = body
  if (!prompt) return jsonError(400, 'Missing required field: prompt')
  if (!imageUrl) return jsonError(400, 'Missing required field: imageUrl')

  const cacheKey = await hashKey(`sd-img2img:${imageUrl}:${prompt}`)
  const cached = await getFromR2(context.env, cacheKey)
  if (cached) {
    return new Response(JSON.stringify({ url: r2PublicUrl(cacheKey), cached: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  let imageBase64: string
  try {
    imageBase64 = await fetchImageAsBase64(imageUrl)
  } catch (err) {
    return jsonError(502, 'Failed to fetch reference image', String(err))
  }

  let result: { image: string }
  try {
    result = await context.env.AI.run(IMG2IMG_MODEL, {
      prompt,
      image: imageBase64,
      strength: DEFAULT_STRENGTH,
      guidance: DEFAULT_GUIDANCE,
    })
  } catch (err) {
    const msg = String(err)
    // CF classifier rejected the full prompt — retry with a safe minimal prompt
    // that contains no product-description text, only visual/photography directives.
    if (msg.includes('NSFW') || msg.includes('nsfw')) {
      const safePrompt =
        'Professional studio product photograph, white background, soft drop shadow beneath product, ' +
        'product filling the full frame, high resolution, no text overlays.'
      try {
        result = await context.env.AI.run(IMG2IMG_MODEL, {
          prompt: safePrompt,
          image: imageBase64,
          strength: DEFAULT_STRENGTH,
          guidance: DEFAULT_GUIDANCE,
        })
      } catch (retryErr) {
        return jsonError(502, 'Workers AI inference failed', String(retryErr))
      }
    } else {
      return jsonError(502, 'Workers AI inference failed', msg)
    }
  }

  const imgBuffer = Uint8Array.from(atob(result.image), c => c.charCodeAt(0)).buffer
  await storeInR2(context.env, cacheKey, imgBuffer, 'image/png')

  return new Response(JSON.stringify({ url: r2PublicUrl(cacheKey), cached: false }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}
