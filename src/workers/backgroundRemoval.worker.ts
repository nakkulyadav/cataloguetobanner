/// <reference lib="webworker" />

import { removeBackground } from '@imgly/background-removal'

self.onmessage = async (event: MessageEvent<{ blob: Blob }>) => {
  try {
    const resultBlob = await removeBackground(event.data.blob)
    self.postMessage({ result: resultBlob })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ error: message })
  }
}
