import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { removeBackground } from '../removeBackgroundService'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REMOTE_URL = 'https://example.com/product.jpg'
const LOCAL_BLOB_URL = 'blob:http://localhost:5173/some-uuid'
const DATA_URI = 'data:image/png;base64,iVBORw0KGgo='
const R2_URL = '/api/images/abc123deadbeef'
const FAKE_BLOB_URL = 'blob:http://localhost/fake-result'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock Response with JSON body and content-type application/json. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Creates a mock Response with raw PNG binary and content-type image/png. */
function pngResponse(data = 'png-bytes'): Response {
  return new Response(new Blob([data], { type: 'image/png' }), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  ;(URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => FAKE_BLOB_URL)
  ;(URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn()

  // Stub FileReader so blobToBase64 resolves synchronously in tests
  const mockFileReader = {
    readAsDataURL: vi.fn(function (this: typeof mockFileReader) {
      this.onload?.({ target: { result: 'data:image/jpeg;base64,Zm9v' } } as unknown as ProgressEvent)
    }),
    onload: null as ((e: ProgressEvent) => void) | null,
    onerror: null as ((e: ProgressEvent) => void) | null,
    result: 'data:image/jpeg;base64,Zm9v',
  }
  vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))
})

afterEach(() => {
  delete (URL as unknown as Record<string, unknown>).createObjectURL
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('removeBackground', () => {
  describe('request body — remote http/https URLs', () => {
    it('sends { imageUrl } without fetching the image locally', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: false }),
      )

      await removeBackground(REMOTE_URL)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, init] = fetchSpy.mock.calls[0]!
      expect(url).toBe('/api/remove-background')
      const body = JSON.parse(init!.body as string)
      expect(body).toEqual({ imageUrl: REMOTE_URL })
    })

    it('does not include imageData when imageUrl is provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: false }),
      )

      await removeBackground(REMOTE_URL)

      const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string)
      expect(body).not.toHaveProperty('imageData')
    })
  })

  describe('request body — local blob: and data: URLs', () => {
    it('fetches a blob: URL locally and sends { imageData, imageMediaType }', async () => {
      const sourceBlob = new Blob(['raw-image'], { type: 'image/jpeg' })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(sourceBlob))  // local fetch
        .mockResolvedValueOnce(jsonResponse({ url: R2_URL, cached: false }))  // api call

      await removeBackground(LOCAL_BLOB_URL)

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0]![0]).toBe(LOCAL_BLOB_URL)

      const body = JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string)
      expect(body).toHaveProperty('imageData')
      expect(body).toHaveProperty('imageMediaType')
      expect(body).not.toHaveProperty('imageUrl')
    })

    it('fetches a data: URI locally and sends { imageData, imageMediaType }', async () => {
      const sourceBlob = new Blob(['raw'], { type: 'image/png' })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(sourceBlob))
        .mockResolvedValueOnce(jsonResponse({ url: R2_URL, cached: false }))

      await removeBackground(DATA_URI)

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0]![0]).toBe(DATA_URI)

      const body = JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string)
      expect(body).toHaveProperty('imageData')
    })

    it('throws if the local fetch returns a non-OK status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 404 }),
      )

      await expect(removeBackground(LOCAL_BLOB_URL)).rejects.toThrow('Failed to fetch image: 404')
    })

    it('throws if the local fetch rejects (network error)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network failure'))

      await expect(removeBackground(LOCAL_BLOB_URL)).rejects.toThrow('network failure')
    })
  })

  describe('response handling — production (JSON)', () => {
    it('returns the R2 url from a JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: false }),
      )

      const result = await removeBackground(REMOTE_URL)
      expect(result).toBe(R2_URL)
    })

    it('returns the R2 url on a cache hit (cached: true)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: true }),
      )

      const result = await removeBackground(REMOTE_URL)
      expect(result).toBe(R2_URL)
    })

    it('does not call URL.createObjectURL for JSON responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: false }),
      )

      await removeBackground(REMOTE_URL)

      expect(
        (URL as unknown as Record<string, ReturnType<typeof vi.fn>>).createObjectURL,
      ).not.toHaveBeenCalled()
    })
  })

  describe('response handling — dev (raw PNG binary)', () => {
    it('wraps raw PNG binary in a blob URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(pngResponse())

      const result = await removeBackground(REMOTE_URL)
      expect(result).toBe(FAKE_BLOB_URL)
      expect(
        (URL as unknown as Record<string, ReturnType<typeof vi.fn>>).createObjectURL,
      ).toHaveBeenCalledOnce()
    })
  })

  describe('error handling — API errors', () => {
    it('throws with the error field from a JSON error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ error: 'HF_TOKEN not configured in environment' }, 500),
      )

      await expect(removeBackground(REMOTE_URL)).rejects.toThrow(
        'HF_TOKEN not configured in environment',
      )
    })

    it('throws with a status-based message when error body is not JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 502 }),
      )

      await expect(removeBackground(REMOTE_URL)).rejects.toThrow(
        'Background removal failed: 502',
      )
    })

    it('throws with a status-based message when error body has no error field', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ detail: null }, 400),
      )

      await expect(removeBackground(REMOTE_URL)).rejects.toThrow(
        'Background removal failed: 400',
      )
    })

    it('throws when the API call rejects with a network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

      await expect(removeBackground(REMOTE_URL)).rejects.toThrow('fetch failed')
    })
  })

  describe('request format', () => {
    it('sends POST with content-type application/json', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse({ url: R2_URL, cached: false }),
      )

      await removeBackground(REMOTE_URL)

      const init = fetchSpy.mock.calls[0]![1]!
      expect(init.method).toBe('POST')
      expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    })
  })
})
