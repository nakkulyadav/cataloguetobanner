import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onRequestPost } from '../generate-image'
import * as r2Storage from '../../lib/r2Storage'

vi.mock('../../lib/r2Storage', () => ({
  hashKey: vi.fn().mockResolvedValue('cafebabe'),
  getFromR2: vi.fn().mockResolvedValue(null),
  storeInR2: vi.fn().mockResolvedValue(undefined),
  r2PublicUrl: vi.fn((key: string) => `/api/images/${key}`),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_URL = '/api/images/cafebabe'
const PROMPT = 'Studio product photo of organic honey jar'
const IMAGE_URL = 'https://example.com/product.jpg'
// Minimal 1×1 PNG base64 — valid enough for the btoa/atob round-trip
const FAKE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const JPEG_BYTES = new Uint8Array([255, 216, 255, 224]).buffer

const mockR2 = r2Storage as unknown as {
  hashKey: ReturnType<typeof vi.fn>
  getFromR2: ReturnType<typeof vi.fn>
  storeInR2: ReturnType<typeof vi.fn>
  r2PublicUrl: ReturnType<typeof vi.fn>
}

function makeAiBinding() {
  return {
    run: vi.fn().mockResolvedValue({ image: FAKE_IMAGE_BASE64 }),
  }
}

function makeEnv(ai = makeAiBinding()): r2Storage.Env {
  return {
    HF_TOKEN: 'test-hf-token',
    IMAGES: {} as r2Storage.Env['IMAGES'],
    AI: ai as unknown as r2Storage.Env['AI'],
  }
}

function makeRequest(body: unknown): Request {
  return new Request('https://worker.example/api/generate-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Mocked response for the imageUrl fetch
function imageUrlFetchResponse(): Response {
  return new Response(new Uint8Array(JPEG_BYTES), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockR2.hashKey.mockResolvedValue('cafebabe')
  mockR2.getFromR2.mockResolvedValue(null)
  mockR2.storeInR2.mockResolvedValue(undefined)
  mockR2.r2PublicUrl.mockImplementation((key: string) => `/api/images/${key}`)
})

describe('onRequestPost — generate-image Worker', () => {
  describe('validation', () => {
    it('returns 400 when prompt is missing', async () => {
      const resp = await onRequestPost({ request: makeRequest({ imageUrl: IMAGE_URL }), env: makeEnv() })
      expect(resp.status).toBe(400)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/prompt/i)
    })

    it('returns 400 when imageUrl is missing', async () => {
      const resp = await onRequestPost({ request: makeRequest({ prompt: PROMPT }), env: makeEnv() })
      expect(resp.status).toBe(400)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/imageUrl/i)
    })

    it('returns 400 for invalid JSON body', async () => {
      const req = new Request('https://worker.example/api/generate-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      })
      const resp = await onRequestPost({ request: req, env: makeEnv() })
      expect(resp.status).toBe(400)
    })
  })

  describe('R2 cache hit', () => {
    it('returns { url, cached: true } immediately without calling AI or fetching imageUrl', async () => {
      mockR2.getFromR2.mockResolvedValue({ arrayBuffer: async () => JPEG_BYTES })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const ai = makeAiBinding()

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(ai),
      })

      expect(resp.status).toBe(200)
      const body = await resp.json() as { url: string; cached: boolean }
      expect(body).toEqual({ url: CACHE_URL, cached: true })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(ai.run).not.toHaveBeenCalled()
      expect(mockR2.storeInR2).not.toHaveBeenCalled()
    })
  })

  describe('R2 cache miss', () => {
    it('fetches imageUrl, calls AI.run, stores result in R2, returns { url, cached: false }', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())
      const ai = makeAiBinding()

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(ai),
      })

      expect(resp.status).toBe(200)
      const body = await resp.json() as { url: string; cached: boolean }
      expect(body).toEqual({ url: CACHE_URL, cached: false })
      expect(ai.run).toHaveBeenCalledOnce()
      expect(mockR2.storeInR2).toHaveBeenCalledOnce()
    })

    it('passes prompt, base64 image, strength, and guidance to AI.run', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())
      const ai = makeAiBinding()

      await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(ai),
      })

      const [model, inputs] = ai.run.mock.calls[0] as [string, Record<string, unknown>]
      expect(model).toBe('@cf/runwayml/stable-diffusion-v1-5-img2img')
      expect(typeof inputs.image).toBe('string') // base64
      expect(inputs.prompt).toBe(PROMPT)
      expect(typeof inputs.strength).toBe('number')
      expect(typeof inputs.guidance).toBe('number')
    })

    it('cache key includes both imageUrl and prompt', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())

      await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      const [cacheInput] = mockR2.hashKey.mock.calls[0] as [string]
      expect(cacheInput).toContain(IMAGE_URL)
      expect(cacheInput).toContain(PROMPT)
    })

    it('stores the AI result as image/png in R2', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())

      await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(mockR2.storeInR2).toHaveBeenCalledWith(
        expect.anything(), 'cafebabe', expect.any(ArrayBuffer), 'image/png',
      )
    })
  })

  describe('error handling', () => {
    it('returns 502 when imageUrl fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(502)
      const body = await resp.json() as { error: string }
      expect(body.error).toMatch(/fetch reference image/i)
    })

    it('returns 502 when imageUrl fetch throws (network error)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network failure'))

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(),
      })

      expect(resp.status).toBe(502)
    })

    it('returns 502 when AI.run throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())
      const ai = makeAiBinding()
      ai.run.mockRejectedValueOnce(new Error('Workers AI inference failed'))

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(ai),
      })

      expect(resp.status).toBe(502)
      expect(mockR2.storeInR2).not.toHaveBeenCalled()
    })

    it('retries with safe prompt when AI.run throws NSFW error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(imageUrlFetchResponse())
      const ai = makeAiBinding()
      ai.run
        .mockRejectedValueOnce(new Error('Input prompt contains NSFW content'))
        .mockResolvedValueOnce({ image: FAKE_IMAGE_BASE64 })

      const resp = await onRequestPost({
        request: makeRequest({ prompt: PROMPT, imageUrl: IMAGE_URL }),
        env: makeEnv(ai),
      })

      expect(resp.status).toBe(200)
      expect(ai.run).toHaveBeenCalledTimes(2)
      // Second call should use the safe minimal prompt
      const [, secondInputs] = ai.run.mock.calls[1] as [string, Record<string, unknown>]
      expect((secondInputs.prompt as string).toLowerCase()).toContain('studio product photograph')
    })
  })
})
