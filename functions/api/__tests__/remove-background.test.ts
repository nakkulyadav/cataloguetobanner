import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onRequestPost } from '../remove-background'
import * as r2Storage from '../../lib/r2Storage'

vi.mock('../../lib/r2Storage', () => ({
  hashKey: vi.fn().mockResolvedValue('deadbeef'),
  getFromR2: vi.fn().mockResolvedValue(null),
  storeInR2: vi.fn().mockResolvedValue(undefined),
  r2PublicUrl: vi.fn((key: string) => `/api/images/${key}`),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_URL = '/api/images/deadbeef'
const IMAGE_URL = 'https://example.com/product.jpg'
const PNG_BYTES = new Uint8Array([137, 80, 78, 71]).buffer // PNG magic bytes

const mockR2 = r2Storage as unknown as {
  hashKey: ReturnType<typeof vi.fn>
  getFromR2: ReturnType<typeof vi.fn>
  storeInR2: ReturnType<typeof vi.fn>
  r2PublicUrl: ReturnType<typeof vi.fn>
}

function makeEnv(hfToken = 'test-hf-token'): r2Storage.Env {
  return {
    HF_TOKEN: hfToken,
    IMAGES: {} as r2Storage.Env['IMAGES'],
  }
}

function makeRequest(body: unknown): Request {
  return new Request('https://worker.example/api/remove-background', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function pngFetchResponse(): Response {
  return new Response(PNG_BYTES, {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockR2.hashKey.mockResolvedValue('deadbeef')
  mockR2.getFromR2.mockResolvedValue(null)
  mockR2.storeInR2.mockResolvedValue(undefined)
  mockR2.r2PublicUrl.mockImplementation((key: string) => `/api/images/${key}`)
})

describe('onRequestPost — remove-background Worker', () => {
  describe('validation', () => {
    it('returns 400 when both imageUrl and imageData are missing', async () => {
      const resp = await onRequestPost({ request: makeRequest({}), env: makeEnv() })
      expect(resp.status).toBe(400)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/imageUrl|imageData/i)
    })

    it('returns 400 when imageUrl uses the blob: scheme', async () => {
      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: 'blob:http://localhost/uuid' }),
        env: makeEnv(),
      })
      expect(resp.status).toBe(400)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/http|https/i)
    })

    it('returns 400 when imageUrl uses the data: scheme', async () => {
      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: 'data:image/png;base64,abc' }),
        env: makeEnv(),
      })
      expect(resp.status).toBe(400)
    })

    it('returns 500 when HF_TOKEN is not configured', async () => {
      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(''),
      })
      expect(resp.status).toBe(500)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/HF_TOKEN/i)
    })
  })

  describe('R2 cache hit', () => {
    it('returns { url, cached: true } immediately without calling HF', async () => {
      mockR2.getFromR2.mockResolvedValue({ arrayBuffer: async () => PNG_BYTES })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(200)
      const body = await resp.json() as { url: string; cached: boolean }
      expect(body).toEqual({ url: CACHE_URL, cached: true })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(mockR2.storeInR2).not.toHaveBeenCalled()
    })
  })

  describe('R2 cache miss', () => {
    it('calls HF, stores result in R2, returns { url, cached: false } for imageUrl', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(pngFetchResponse())  // upstream image fetch
        .mockResolvedValueOnce(pngFetchResponse())  // HF RMBG call

      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(200)
      const body = await resp.json() as { url: string; cached: boolean }
      expect(body).toEqual({ url: CACHE_URL, cached: false })
      expect(mockR2.storeInR2).toHaveBeenCalledOnce()
      expect(mockR2.storeInR2).toHaveBeenCalledWith(
        expect.anything(), 'deadbeef', expect.any(ArrayBuffer), 'image/png',
      )
    })

    it('calls HF with base64-decoded bytes when imageData is provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(pngFetchResponse())
      const imageData = btoa('fake-image-bytes')

      const resp = await onRequestPost({
        request: makeRequest({ imageData, imageMediaType: 'image/jpeg' }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(200)
      const body = await resp.json() as { url: string; cached: boolean }
      expect(body).toEqual({ url: CACHE_URL, cached: false })
      // Only one fetch: the HF call (no upstream image fetch needed for imageData)
      expect(fetchSpy).toHaveBeenCalledOnce()
    })

    it('uses a distinct cache key prefix for imageData vs imageUrl', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(pngFetchResponse()) // upstream image fetch
        .mockResolvedValueOnce(pngFetchResponse()) // HF call

      await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })
      const urlInput = mockR2.hashKey.mock.calls[0]?.[0] as string

      vi.clearAllMocks()
      mockR2.hashKey.mockResolvedValue('deadbeef')
      mockR2.getFromR2.mockResolvedValue(null)
      mockR2.storeInR2.mockResolvedValue(undefined)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(pngFetchResponse()) // HF call only

      await onRequestPost({
        request: makeRequest({ imageData: btoa('bytes') }),
        env: makeEnv(),
      })
      const dataInput = mockR2.hashKey.mock.calls[0]?.[0] as string

      expect(urlInput.startsWith('rmbg:')).toBe(true)
      expect(dataInput.startsWith('rmbg-data:')).toBe(true)
    })
  })

  describe('HF error handling', () => {
    it('returns 502 when HF responds with non-OK status', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(pngFetchResponse()) // upstream image fetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Model overloaded' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
        )

      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(502)
    })

    it('returns 502 with loading message for 503 with estimated_time', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(pngFetchResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'loading', estimated_time: 30 }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
        )

      const resp = await onRequestPost({
        request: makeRequest({ imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(502)
      const body = await resp.json() as { detail: string }
      expect(body.detail).toMatch(/30s/i)
    })
  })
})
