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

  it('sends correct request and returns a blob URL on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    const result = await removeBackground(FAKE_IMAGE_URL)

    // Verify the API was called correctly
    expect(fetchSpy).toHaveBeenCalledOnce()
    const callArgs = fetchSpy.mock.calls[0]!
    const url = callArgs[0]
    const options = callArgs[1]
    expect(url).toBe('https://api.remove.bg/v1.0/removebg')
    expect(options?.method).toBe('POST')
    expect((options?.headers as Record<string, string>)['X-Api-Key']).toBe(FAKE_API_KEY)

    // Verify FormData contains image_url and size
    const body = options?.body as FormData
    expect(body.get('image_url')).toBe(FAKE_IMAGE_URL)
    expect(body.get('size')).toBe('auto')

    // Verify it returns a blob URL
    expect(result).toBe(FAKE_BLOB_URL)
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
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
