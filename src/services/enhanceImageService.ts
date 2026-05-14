function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

/**
 * Upscales an image using Real-ESRGAN (4×) via the /api/enhance-image worker.
 *
 * For local blob/data URLs the image bytes are base64-encoded and sent directly.
 * For remote URLs the worker fetches them server-side (avoids CORS).
 *
 * @returns A same-origin `/api/images/...` URL pointing to the enhanced image.
 */
export async function enhanceImage(imageUrl: string): Promise<string> {
  let body: Record<string, string>

  if (isLocalUrl(imageUrl)) {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Failed to read local image: ${response.status}`)
    const blob = await response.blob()
    const base64 = await blobToBase64(blob)
    body = { imageData: base64, imageMediaType: blob.type || 'image/jpeg' }
  } else {
    body = { imageUrl }
  }

  const resp = await fetch('/api/enhance-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    let errorMsg = `Image enhancement failed (HTTP ${resp.status})`
    try {
      const errBody = (await resp.json()) as { error?: string; detail?: string }
      if (errBody.error) {
        errorMsg = errBody.detail ? `${errBody.error}: ${errBody.detail}` : errBody.error
      }
    } catch {
      // use default message
    }
    throw new Error(errorMsg)
  }

  const { url } = (await resp.json()) as { url: string; cached: boolean }
  return url
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip the "data:<type>;base64," prefix
      const base64 = dataUrl.split(',')[1]
      if (!base64) reject(new Error('Invalid data URL format'))
      else resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read blob as base64'))
    reader.readAsDataURL(blob)
  })
}
