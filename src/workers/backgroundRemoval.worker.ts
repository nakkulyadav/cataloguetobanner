/// <reference lib="webworker" />

/**
 * Web Worker for background removal inference.
 *
 * Runs @imgly/background-removal entirely off the main thread so the browser
 * never blocks during the heavyweight WASM / ONNX inference step. The worker
 * is a thin message-passing shell: it receives a raw image Blob, delegates
 * to the library, and posts back either a result Blob or an error string.
 *
 * Message protocol (both directions use plain objects — no Transferables
 * needed since jsdom and most browsers handle Blob transfer by structured
 * clone, which is fine for our sizes):
 *
 *   Incoming: { blob: Blob }
 *   Outgoing: { result: Blob }  — on success
 *             { error: string } — on failure
 *
 * The caller (removeBackgroundService.ts) creates a fresh worker instance per
 * request and terminates it immediately after the response arrives, freeing
 * the WASM heap between calls.
 */

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
