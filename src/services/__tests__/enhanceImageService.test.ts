import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enhanceImage } from '../enhanceImageService'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('enhanceImage — remote URL', () => {
  it('returns the url from the API on success', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ url: '/api/images/abc123', cached: false }))

    const result = await enhanceImage('https://example.com/product.jpg')
    expect(result).toBe('/api/images/abc123')
  })

  it('sends imageUrl in the POST body for remote URLs', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ url: '/api/images/xyz', cached: false }))

    await enhanceImage('https://example.com/product.jpg')

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/enhance-image')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.imageUrl).toBe('https://example.com/product.jpg')
    expect(body.imageData).toBeUndefined()
  })

  it('returns the cached url when cached: true', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ url: '/api/images/cached', cached: true }))

    const result = await enhanceImage('https://example.com/product.jpg')
    expect(result).toBe('/api/images/cached')
  })

  it('throws on non-ok response with error message', async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ error: 'HuggingFace inference error', detail: 'Model is loading' }, 502),
    )

    await expect(enhanceImage('https://example.com/product.jpg')).rejects.toThrow(
      'HuggingFace inference error: Model is loading',
    )
  })

  it('throws with HTTP status when response body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))

    await expect(enhanceImage('https://example.com/product.jpg')).rejects.toThrow(
      'Image enhancement failed (HTTP 502)',
    )
  })

  it('throws when error field is present but detail is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ error: 'HF_TOKEN not configured in environment' }, 500))

    await expect(enhanceImage('https://example.com/product.jpg')).rejects.toThrow(
      'HF_TOKEN not configured in environment',
    )
  })
})

describe('enhanceImage — blob/data URL', () => {
  it('fetches the local blob and sends imageData + imageMediaType', async () => {
    // First fetch: reading the blob URL
    const blobContent = new Blob(['fake-image-bytes'], { type: 'image/png' })
    mockFetch.mockResolvedValueOnce(new Response(blobContent, { status: 200, headers: { 'content-type': 'image/png' } }))
    // Second fetch: the /api/enhance-image call
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ url: '/api/images/blob-result', cached: false }))

    const result = await enhanceImage('blob:http://localhost/fake-blob-id')
    expect(result).toBe('/api/images/blob-result')

    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/enhance-image')
    const body = JSON.parse(init.body as string)
    expect(body.imageData).toBeDefined()
    expect(body.imageMediaType).toBe('image/png')
    expect(body.imageUrl).toBeUndefined()
  })

  it('throws when local blob fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }))

    await expect(enhanceImage('blob:http://localhost/missing')).rejects.toThrow(
      'Failed to read local image: 404',
    )
  })
})
