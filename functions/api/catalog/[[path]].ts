/**
 * Cloudflare Pages Function — proxies /api/catalog/* to the Digihaat backend.
 *
 * In dev, Vite handles this proxy (vite.config.ts server.proxy).
 * In production on Cloudflare Pages, this function takes over.
 */
export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url)

  // Strip the /api/catalog prefix and forward to the real backend
  const backendPath = url.pathname.replace(/^\/api\/catalog/, '')
  const backendUrl = `https://prod.digihaat.in/analyticsDashboard/catalog${backendPath}${url.search}`

  // Replicate Vite's `changeOrigin: true` — forward only safe headers and
  // set Host to the target so the backend doesn't reject the request.
  const forwardHeaders = new Headers()
  for (const [key, value] of context.request.headers.entries()) {
    const lower = key.toLowerCase()
    if (lower === 'origin' || lower === 'referer' || lower === 'host') continue
    forwardHeaders.set(key, value)
  }
  forwardHeaders.set('host', 'prod.digihaat.in')

  const backendRequest = new Request(backendUrl, {
    method: context.request.method,
    headers: forwardHeaders,
    body: context.request.body,
  })

  let backendResponse: Response
  try {
    backendResponse = await fetch(backendRequest)
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
