const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

// swin2SR via fal-ai provider on the HF router.
// hf-inference dropped support; fal-ai still hosts this model.
const HF_ESRGAN_ENDPOINT =
  'https://router.huggingface.co/fal-ai/models/caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr'

interface Env {
  HF_TOKEN: string
}

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail: detail ?? null }), {
    status,
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

  // Resolve image to raw bytes
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
  const bytes = new Uint8Array(enhancedBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const url = `data:image/png;base64,${btoa(binary)}`

  return new Response(JSON.stringify({ url, cached: false }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}
