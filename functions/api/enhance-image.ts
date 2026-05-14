import { Env, getFromR2, hashKey, r2PublicUrl, storeInR2 } from '../lib/r2Storage'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

// swin2SR via fal-ai provider on the HF router.
// hf-inference dropped support; fal-ai still hosts this model.
const HF_ESRGAN_ENDPOINT =
  'https://router.huggingface.co/fal-ai/models/caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr'

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail: detail ?? null }), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

function jsonOk(url: string, cached: boolean): Response {
  return new Response(JSON.stringify({ url, cached }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function onRequestPost(context: {
  request: Request
  env: Env
}): Promise<Response> {
  let body: { imageUrl?: string; imageData?: string; imageMediaType?: string }
  try {
    body = await context.request.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const { imageUrl, imageData, imageMediaType } = body

  if (!imageUrl && !imageData) {
    return jsonError(400, 'Provide either imageUrl or imageData')
  }

  if (imageUrl) {
    let parsed: URL
    try {
      parsed = new URL(imageUrl)
    } catch {
      return jsonError(400, 'imageUrl is not a valid URL')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return jsonError(400, 'imageUrl must use http or https scheme')
    }
  }

  if (!context.env.HF_TOKEN) {
    return jsonError(500, 'HF_TOKEN not configured in environment')
  }

  // Use a stable cache key so re-runs of the same image hit R2 immediately.
  // Prefix kept as 'esrgan:' for backward-compat with any existing cached entries.
  const cacheInput = imageUrl ? `esrgan:${imageUrl}` : `esrgan-data:${imageData}`
  const cacheKey = await hashKey(cacheInput)

  const cached = await getFromR2(context.env, cacheKey)
  if (cached) {
    return jsonOk(r2PublicUrl(cacheKey), true)
  }

  // Resolve image to raw bytes (same pattern as remove-background.ts)
  let imageBytes: ArrayBuffer
  let sourceContentType: string
  if (imageUrl) {
    let upstream: Response
    try {
      upstream = await fetch(imageUrl)
    } catch (err) {
      return jsonError(502, 'Failed to fetch imageUrl', String(err))
    }
    if (!upstream.ok) {
      return jsonError(502, 'Upstream image fetch failed', `HTTP ${upstream.status}`)
    }
    sourceContentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    imageBytes = await upstream.arrayBuffer()
  } else {
    sourceContentType = imageMediaType ?? 'image/jpeg'
    try {
      const binary = atob(imageData!)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      imageBytes = bytes.buffer
    } catch {
      return jsonError(400, 'imageData is not valid base64')
    }
  }

  // POST raw image bytes to HuggingFace; response is the enhanced image bytes
  let hfResp: Response
  try {
    hfResp = await fetch(HF_ESRGAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${context.env.HF_TOKEN}`,
        'content-type': sourceContentType,
      },
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
    } catch {
      detail = `HTTP ${hfResp.status}`
    }
    return jsonError(502, 'HuggingFace inference error', detail)
  }

  const enhancedBuffer = await hfResp.arrayBuffer()
  await storeInR2(context.env, cacheKey, enhancedBuffer, 'image/png')

  return jsonOk(r2PublicUrl(cacheKey), false)
}
