const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

// Duck-typed CF Cache API — caches.default isn't in standard browser TS lib
type CFCacheStorage = { default: { match(req: Request): Promise<Response | undefined>; put(req: Request, resp: Response): Promise<void> } }

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, detail: detail ?? null }), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Strips the JSONP wrapper Google wraps around gviz/tq responses.
 * Input:  `/*O_o*‌/\ngoogle.visualization.Query.setResponse({...});`
 * Output: the JSON object string inside the outermost parentheses.
 */
function stripJsonpWrapper(raw: string): string {
  const start = raw.indexOf('(')
  const end = raw.lastIndexOf(')')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unexpected gviz/tq response format — could not find JSONP wrapper')
  }
  return raw.slice(start + 1, end)
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function onRequestGet(context: {
  request: Request
  env: Record<string, unknown>
  waitUntil(promise: Promise<unknown>): void
}): Promise<Response> {
  const reqUrl = new URL(context.request.url)
  const sheetId = reqUrl.searchParams.get('sheetId')
  const gid = reqUrl.searchParams.get('gid')

  if (!sheetId) {
    return jsonError(400, 'Missing required query param: sheetId')
  }

  // CF Cache API — keyed on our own endpoint URL (sheetId + gid)
  const cache = (caches as unknown as CFCacheStorage).default
  const cacheKey = new Request(context.request.url)
  const cachedResp = await cache.match(cacheKey)
  if (cachedResp) return cachedResp

  // Build gviz URL
  const gvizUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`)
  gvizUrl.searchParams.set('tqx', 'out:json')
  if (gid) gvizUrl.searchParams.set('gid', gid)

  let gvizResp: Response
  try {
    gvizResp = await fetch(gvizUrl.toString())
  } catch (err) {
    return jsonError(502, 'Failed to reach Google Sheets API', String(err))
  }

  if (!gvizResp.ok) {
    return jsonError(502, 'Google Sheets API error', `HTTP ${gvizResp.status}`)
  }

  const rawText = await gvizResp.text()
  let jsonText: string
  try {
    jsonText = stripJsonpWrapper(rawText)
  } catch (err) {
    return jsonError(502, 'Unexpected Google Sheets response format', String(err))
  }

  // Validate parseable before caching
  try {
    JSON.parse(jsonText)
  } catch {
    return jsonError(502, 'Failed to parse Google Sheets response as JSON')
  }

  const response = new Response(jsonText, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
      ...CORS_HEADERS,
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}
