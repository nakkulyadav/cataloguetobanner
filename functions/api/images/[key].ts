import { Env, getFromR2 } from '../../lib/r2Storage'

export async function onRequestGet(context: {
  params: { key: string }
  env: Env
}): Promise<Response> {
  const { key } = context.params

  const object = await getFromR2(context.env, key)
  if (!object) {
    return new Response('Not Found', { status: 404 })
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  const data = await object.arrayBuffer()

  return new Response(data, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
