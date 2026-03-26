/**
 * Service for removing image backgrounds using @imgly/background-removal.
 *
 * Runs entirely in the browser via WebAssembly + ONNX — no API key or
 * external service required. The ONNX model (~170 MB) is downloaded from
 * the imgly CDN on first use and cached by the browser thereafter.
 *
 * For remote image URLs the image is first fetched through our /api/image
 * proxy (production) or directly (dev) to avoid CORS issues with external
 * hosts like storage.googleapis.com.
 */

import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'

function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

/**
 * Removes the background from an image.
 *
 * @param imageUrl — Public URL, blob URL, or data URI of the image to process.
 * @returns A same-origin blob URL (`blob:...`) pointing to the transparent PNG.
 *          Caller is responsible for revoking it via `URL.revokeObjectURL()`.
 * @throws If the image cannot be fetched or the model fails to process it.
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  let source: Blob

  if (isLocalUrl(imageUrl)) {
    // Local blob/data URI — fetch the binary locally
    const response = await fetch(imageUrl)
    source = await response.blob()
  } else {
    // Remote URL — fetch through proxy in prod to avoid CORS; directly in dev
    const fetchUrl = import.meta.env.DEV
      ? imageUrl
      : `/api/image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(fetchUrl)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
    source = await response.blob()
  }

  const resultBlob = await imglyRemoveBackground(source)
  return URL.createObjectURL(resultBlob)
}
