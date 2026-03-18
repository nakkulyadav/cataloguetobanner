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

  const backendRequest = new Request(backendUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  })

  return fetch(backendRequest)
}
