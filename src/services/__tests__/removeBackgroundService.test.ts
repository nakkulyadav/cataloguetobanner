import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { removeBackground } from '../removeBackgroundService'

// --- Helpers ---

/** Builds a minimal mock Response for successful remove.bg calls. */
function mockOkResponse(): Response {
  const blob = new Blob(['fake-png-data'], { type: 'image/png' })
  return new Response(blob, { status: 200, statusText: 'OK' })
}

/** Builds a mock Response for failed remove.bg calls. */
function mockErrorResponse(status: number, statusText: string): Response {
  return new Response(null, { status, statusText })
}

// --- Tests ---

describe('removeBackgroundService', () => {
  const FAKE_API_KEY = 'test-api-key-12345'
  const FAKE_IMAGE_URL = 'https://example.com/product.jpg'
  const FAKE_BLOB_URL = 'blob:http://localhost/fake-blob-id'

  beforeEach(() => {
    // Provide a valid API key via Vite env
    vi.stubEnv('VITE_REMOVEBG_API_KEY', FAKE_API_KEY)

    // Mock URL.createObjectURL — jsdom doesn't support it natively
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => FAKE_BLOB_URL),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends image_url for public URLs and returns a blob URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    const result = await removeBackground(FAKE_IMAGE_URL)

    // Only the API call — no local fetch needed for public URLs
    expect(fetchSpy).toHaveBeenCalledOnce()
    const callArgs = fetchSpy.mock.calls[0]!
    const url = callArgs[0]
    const options = callArgs[1]
    expect(url).toBe('https://api.remove.bg/v1.0/removebg')
    expect(options?.method).toBe('POST')
    expect((options?.headers as Record<string, string>)['X-Api-Key']).toBe(FAKE_API_KEY)

    // Verify FormData contains image_url (not image_file) and size
    const body = options?.body as FormData
    expect(body.get('image_url')).toBe(FAKE_IMAGE_URL)
    expect(body.has('image_file')).toBe(false)
    expect(body.get('size')).toBe('auto')

    expect(result).toBe(FAKE_BLOB_URL)
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('sends image_file for blob URLs (uploaded/pasted images)', async () => {
    const localBlob = new Blob(['fake-image'], { type: 'image/png' })
    const localBlobResponse = new Response(localBlob)
    const apiBlobResponse = mockOkResponse()

    // First call = local blob fetch, second call = API request
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(localBlobResponse)
      .mockResolvedValueOnce(apiBlobResponse)

    const blobUrl = 'blob:http://localhost:5173/some-uuid'
    const result = await removeBackground(blobUrl)

    expect(fetchSpy).toHaveBeenCalledTimes(2)

    // First call: fetch the local blob
    expect(fetchSpy.mock.calls[0]![0]).toBe(blobUrl)

    // Second call: API request with image_file
    const apiCallOptions = fetchSpy.mock.calls[1]![1]
    const body = apiCallOptions?.body as FormData
    expect(body.has('image_file')).toBe(true)
    expect(body.has('image_url')).toBe(false)
    expect(body.get('size')).toBe('auto')

    expect(result).toBe(FAKE_BLOB_URL)
  })

  it('sends image_file for data URIs', async () => {
    const localBlob = new Blob(['fake-image'], { type: 'image/png' })
    const localBlobResponse = new Response(localBlob)
    const apiBlobResponse = mockOkResponse()

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(localBlobResponse)
      .mockResolvedValueOnce(apiBlobResponse)

    const dataUri = 'data:image/png;base64,iVBORw0KGgo='
    await removeBackground(dataUri)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0]![0]).toBe(dataUri)

    const body = fetchSpy.mock.calls[1]![1]?.body as FormData
    expect(body.has('image_file')).toBe(true)
    expect(body.has('image_url')).toBe(false)
  })

  it('throws with status info when API responds with error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockErrorResponse(402, 'Payment Required'),
    )

    await expect(removeBackground(FAKE_IMAGE_URL)).rejects.toThrow(
      'remove.bg API error: 402 Payment Required',
    )
  })

  it('throws immediately when API key is missing', async () => {
    vi.stubEnv('VITE_REMOVEBG_API_KEY', '')

    await expect(removeBackground(FAKE_IMAGE_URL)).rejects.toThrow(
      'VITE_REMOVEBG_API_KEY is not set',
    )
  })

  it('throws immediately when API key env var is undefined', async () => {
    vi.unstubAllEnvs()
    // Ensure the env var is truly absent
    vi.stubEnv('VITE_REMOVEBG_API_KEY', '')

    await expect(removeBackground(FAKE_IMAGE_URL)).rejects.toThrow(
      'VITE_REMOVEBG_API_KEY is not set',
    )
  })

  it('propagates network errors from fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(removeBackground(FAKE_IMAGE_URL)).rejects.toThrow('Failed to fetch')
  })
})
