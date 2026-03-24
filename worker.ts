/**
 * Cloudflare Worker entry point.
 *
 * Handles /api/catalog/* as a reverse proxy to the Digihaat backend.
 * All other requests are served from the static asset bundle (dist/).
 */

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> }
  REMOVEBG_API_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/catalog')) {
      return proxyCatalog(request, url)
    }

    if (url.pathname === '/api/removebg' && request.method === 'POST') {
      return proxyRemoveBg(request, env.REMOVEBG_API_KEY)
    }

    if (url.pathname === '/api/image' && request.method === 'GET') {
      return proxyImage(url)
    }

    return env.ASSETS.fetch(request)
  },
}

async function proxyCatalog(request: Request, url: URL): Promise<Response> {
  const backendPath = url.pathname.replace(/^\/api\/catalog/, '')
  const backendUrl = `https://prod.digihaat.in/analyticsDashboard/catalog${backendPath}${url.search}`

  // Strip browser-specific headers so the backend doesn't reject the request
  const forwardHeaders = new Headers()
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase()
    if (lower === 'origin' || lower === 'referer' || lower === 'host') continue
    forwardHeaders.set(key, value)
  }
  forwardHeaders.set('host', 'prod.digihaat.in')

  let backendResponse: Response
  try {
    backendResponse = await fetch(
      new Request(backendUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: request.body,
      }),
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach backend', detail: String(err) }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }

  const contentType = backendResponse.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const body = await backendResponse.text()
    return new Response(
      JSON.stringify({
        error: 'Backend returned an unexpected response',
        backendStatus: backendResponse.status,
        backendContentType: contentType,
        backendUrl,
        backendBodySnippet: body.slice(0, 300),
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }

  return backendResponse
}

async function proxyImage(url: URL): Promise<Response> {
  const imageUrl = url.searchParams.get('url')
  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(imageUrl)
  } catch (err) {
    return new Response(`Failed to fetch image: ${String(err)}`, { status: 502 })
  }

  const headers = new Headers()
  headers.set('content-type', response.headers.get('content-type') ?? 'image/jpeg')
  headers.set('access-control-allow-origin', '*')
  headers.set('cache-control', 'public, max-age=86400')

  return new Response(response.body, { status: response.status, headers })
}

async function proxyRemoveBg(request: Request, apiKey: string): Promise<Response> {
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'REMOVEBG_API_KEY is not configured on the server' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  const incomingForm = await request.formData()
  const outgoingForm = new FormData()

  const imageUrl = incomingForm.get('image_url')
  const imageFile = incomingForm.get('image_file')

  if (typeof imageUrl === 'string') {
    outgoingForm.append('image_url', imageUrl)
  } else if (imageFile != null && typeof imageFile !== 'string') {
    outgoingForm.append('image_file', imageFile as Blob, 'image.png')
  } else {
    return new Response(
      JSON.stringify({ error: 'Missing image_url or image_file in request' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  outgoingForm.append('size', 'auto')

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: outgoingForm,
  })

  // Forward the binary PNG (or error body) straight back to the client
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
    },
  })
}
