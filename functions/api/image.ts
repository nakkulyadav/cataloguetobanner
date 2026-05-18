const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const reqUrl = new URL(context.request.url)
  const url = reqUrl.searchParams.get('url')

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing required query param: url' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: 'URL must use http or https scheme' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  let upstream: Response
  try {
    upstream = await fetch(url)
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch image', detail: String(err) }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Upstream fetch failed: HTTP ${upstream.status}` }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    })
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  const imageData = await upstream.arrayBuffer()

  return new Response(imageData, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=3600',
      ...CORS_HEADERS,
    },
  })
}
