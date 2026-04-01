import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { removeBackground } from '../removeBackgroundService'

// ---------------------------------------------------------------------------
// Mock Worker
// ---------------------------------------------------------------------------

/**
 * Minimal stand-in for the browser's Worker API.
 *
 * The constructor captures a reference to the latest instance so individual
 * tests can drive the worker's response by calling triggerMessage /
 * triggerError directly.
 *
 * We don't stub the Worker URL — it is ignored by the mock constructor.
 */
interface WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
}

let lastWorker: WorkerLike | null = null

function MockWorkerConstructor(_url: URL, _opts?: WorkerOptions) {
  const instance: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
  lastWorker = instance
  return instance
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_BLOB_URL = 'blob:http://localhost/fake-result'
const REMOTE_IMAGE_URL = 'https://example.com/product.jpg'
const LOCAL_BLOB_URL = 'blob:http://localhost:5173/some-uuid'
const DATA_URI = 'data:image/png;base64,iVBORw0KGgo='

/** Flushes all pending microtasks and macrotasks so that async code (fetch
 *  awaits, worker creation) runs to the point where the worker is ready. */
const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/** Simulates the worker posting a successful result back to the service. */
function triggerWorkerSuccess(resultBlob: Blob) {
  lastWorker!.onmessage!({ data: { result: resultBlob } } as MessageEvent)
}

/** Simulates the worker posting an error string back to the service. */
function triggerWorkerError(message: string) {
  lastWorker!.onmessage!({ data: { error: message } } as MessageEvent)
}

/** Simulates a Worker-level error event (e.g. worker script failed to load). */
function triggerWorkerLoadError(message: string) {
  lastWorker!.onerror!({ message } as ErrorEvent)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  lastWorker = null

  // Replace the global Worker constructor with our lightweight mock.
  vi.stubGlobal('Worker', MockWorkerConstructor)

  // jsdom does not implement URL.createObjectURL / revokeObjectURL at all,
  // so vi.spyOn cannot be used (the property doesn't exist to spy on).
  // We attach vi.fn() stubs directly to the URL class and delete them in
  // afterEach so no state bleeds between tests.
  // The URL *constructor* itself is untouched — new URL(path, base) still
  // works, which is needed by the service to construct the worker script URL.
  ;(URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => FAKE_BLOB_URL)
  ;(URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn()
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

describe('removeBackground — Worker integration', () => {
  describe('remote URLs (fetched via /api/image proxy)', () => {
    it('resolves with a blob URL when the worker reports success', async () => {
      const resultBlob = new Blob(['png-data'], { type: 'image/png' })
      const proxyResponse = new Response(new Blob(['raw'], { type: 'image/jpeg' }))
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(proxyResponse)

      const promise = removeBackground(REMOTE_IMAGE_URL)

      // Let fetch + blob() microtasks run so the Worker is created and
      // postMessage has been called before we simulate the response.
      await flushPromises()
      triggerWorkerSuccess(resultBlob)

      const result = await promise
      expect(result).toBe(FAKE_BLOB_URL)
      expect((URL as unknown as Record<string, ReturnType<typeof vi.fn>>).createObjectURL)
        .toHaveBeenCalledWith(resultBlob)
    })

    it('routes remote URLs through the /api/image proxy', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(new Blob(['raw'])))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerSuccess(new Blob())

      await promise

      expect(fetchSpy).toHaveBeenCalledOnce()
      const calledUrl = fetchSpy.mock.calls[0]![0] as string
      expect(calledUrl).toMatch(/^\/api\/image\?url=/)
      expect(calledUrl).toContain(encodeURIComponent(REMOTE_IMAGE_URL))
    })

    it('throws when the proxy fetch returns a non-OK status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 404, statusText: 'Not Found' }),
      )

      await expect(removeBackground(REMOTE_IMAGE_URL)).rejects.toThrow(
        'Failed to fetch image: 404',
      )

      // Worker should never be created if the fetch fails before it.
      expect(lastWorker).toBeNull()
    })
  })

  describe('local URLs (blob: and data: — no proxy needed)', () => {
    it('fetches blob: URLs directly without routing through the proxy', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(new Blob(['raw'])))

      const promise = removeBackground(LOCAL_BLOB_URL)
      await flushPromises()
      triggerWorkerSuccess(new Blob())

      await promise

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(fetchSpy.mock.calls[0]![0]).toBe(LOCAL_BLOB_URL)
    })

    it('fetches data: URIs directly without routing through the proxy', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(new Blob(['raw'])))

      const promise = removeBackground(DATA_URI)
      await flushPromises()
      triggerWorkerSuccess(new Blob())

      await promise

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(fetchSpy.mock.calls[0]![0]).toBe(DATA_URI)
    })
  })

  describe('Worker lifecycle', () => {
    it('sends the image blob to the worker via postMessage', async () => {
      const sourceBlob = new Blob(['source-image'], { type: 'image/jpeg' })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(sourceBlob))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerSuccess(new Blob())

      await promise

      expect(lastWorker!.postMessage).toHaveBeenCalledOnce()
      const payload = lastWorker!.postMessage.mock.calls[0]![0]
      expect(payload).toHaveProperty('blob')
      expect(payload.blob).toBeInstanceOf(Blob)
    })

    it('terminates the worker after a successful response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerSuccess(new Blob())

      await promise

      expect(lastWorker!.terminate).toHaveBeenCalledOnce()
    })

    it('terminates the worker after an error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerError('Model failed to load')

      await expect(promise).rejects.toThrow('Model failed to load')
      expect(lastWorker!.terminate).toHaveBeenCalledOnce()
    })

    it('terminates the worker on a Worker onerror event', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerLoadError('Failed to load worker script')

      await expect(promise).rejects.toThrow('Failed to load worker script')
      expect(lastWorker!.terminate).toHaveBeenCalledOnce()
    })

    it('creates a fresh Worker for each call (no shared state)', async () => {
      // Each call must get its own Response — a Response body can only be read once.
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(new Blob(['raw']))),
      )

      // First call
      const p1 = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      const worker1 = lastWorker
      triggerWorkerSuccess(new Blob())
      await p1

      // Second call
      const p2 = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      const worker2 = lastWorker
      triggerWorkerSuccess(new Blob())
      await p2

      expect(worker1).not.toBe(worker2)
    })
  })

  describe('error handling', () => {
    it('rejects with the error string from the worker message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerError('ONNX inference failed: out of memory')

      await expect(promise).rejects.toThrow('ONNX inference failed: out of memory')
    })

    it('rejects with a descriptive message when worker posts an empty response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      // Post neither result nor error — malformed response
      lastWorker!.onmessage!({ data: {} } as MessageEvent)

      await expect(promise).rejects.toThrow('unexpected empty response')
    })

    it('rejects when the onerror event has an empty message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob()))

      const promise = removeBackground(REMOTE_IMAGE_URL)
      await flushPromises()
      triggerWorkerLoadError('')

      await expect(promise).rejects.toThrow('Background removal worker encountered an error')
    })

    it('propagates network errors from the image fetch', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network error'))

      await expect(removeBackground(REMOTE_IMAGE_URL)).rejects.toThrow('Network error')
      expect(lastWorker).toBeNull()
    })
  })
})
