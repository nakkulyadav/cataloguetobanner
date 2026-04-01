/**
 * Service for removing image backgrounds using @imgly/background-removal.
 *
 * Inference runs entirely in a dedicated Web Worker (backgroundRemoval.worker.ts)
 * so the main thread — and therefore the browser UI — is never blocked by the
 * heavyweight WASM / ONNX computation. The ONNX model (~170 MB) is downloaded
 * from the imgly CDN on first use and cached by the browser thereafter.
 *
 * For remote image URLs the image is first fetched through our /api/image proxy
 * (production) or directly (dev) to avoid CORS issues with external hosts like
 * storage.googleapis.com. This fetch happens on the main thread (it is fast);
 * only the inference step is offloaded.
 *
 * A fresh Worker instance is created for every call and terminated immediately
 * after the response arrives. This keeps the WASM heap from accumulating across
 * multiple invocations and makes the call self-contained.
 *
 * publicPath note: @imgly/background-removal resolves model/WASM file URLs
 * relative to import.meta.url at runtime. When running inside a module Worker
 * (format: 'es' in vite.config.ts worker block) import.meta.url is the worker
 * bundle's URL, so the relative CDN imports the library already embeds resolve
 * correctly — no explicit publicPath config is needed.
 */

/** Returns true for URLs that are already same-origin (no CORS proxy needed). */
function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

/**
 * Removes the background from an image by delegating to a Web Worker that
 * runs @imgly/background-removal off the main thread.
 *
 * @param imageUrl — Public URL, blob URL, or data URI of the image to process.
 * @returns A same-origin blob URL (`blob:...`) pointing to the transparent PNG.
 *          Caller is responsible for revoking it via `URL.revokeObjectURL()`.
 * @throws If the image cannot be fetched, the Worker fails to load, or the
 *         model cannot process the image.
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  // --- Step 1: Fetch the source image into a Blob on the main thread ---
  // The CORS proxy call must happen here because fetch() from inside a Worker
  // would still be cross-origin (the Worker shares the page's origin, but the
  // proxy is what adds the CORS header on the server side — that still works
  // from a Worker). We keep it on the main thread for consistency and simplicity.
  let source: Blob

  if (isLocalUrl(imageUrl)) {
    // blob: / data: URIs are same-origin — fetch directly.
    const response = await fetch(imageUrl)
    source = await response.blob()
  } else {
    // Remote URL — route through the /api/image proxy so the browser never
    // makes a cross-origin request. In dev, Vite serves this via the
    // imageProxyPlugin middleware; in prod, a serverless function handles it.
    const fetchUrl = `/api/image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(fetchUrl)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
    source = await response.blob()
  }

  // --- Step 2: Offload inference to a Worker ---
  // A new Worker is spawned per call so that:
  //  a) WASM heap memory is freed promptly after each image (terminate() releases it).
  //  b) Concurrent calls (e.g. builder + scheduled modes) don't share state.
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/backgroundRemoval.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent<{ result?: Blob; error?: string }>) => {
      worker.terminate()

      if (event.data.error) {
        reject(new Error(event.data.error))
      } else if (event.data.result) {
        resolve(URL.createObjectURL(event.data.result))
      } else {
        reject(new Error('Background removal worker returned an unexpected empty response'))
      }
    }

    worker.onerror = (event: ErrorEvent) => {
      worker.terminate()
      reject(new Error(event.message || 'Background removal worker encountered an error'))
    }

    // Hand off the pre-fetched Blob — structured-clone copies it safely.
    worker.postMessage({ blob: source })
  })
}
