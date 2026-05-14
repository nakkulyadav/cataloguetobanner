function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

/**
 * Removes the background from an image by delegating inference to a Web Worker
 * so the main thread (and browser UI) is never blocked by WASM/ONNX computation.
 *
 * @param imageUrl — Public URL, blob URL, or data URI of the image to process.
 * @returns A same-origin blob URL (`blob:...`) pointing to the transparent PNG.
 *          Caller is responsible for revoking it via `URL.revokeObjectURL()`.
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  let source: Blob

  if (isLocalUrl(imageUrl)) {
    const response = await fetch(imageUrl)
    source = await response.blob()
  } else {
    const fetchUrl = `/api/image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(fetchUrl)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
    source = await response.blob()
  }

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

    worker.postMessage({ blob: source })
  })
}
