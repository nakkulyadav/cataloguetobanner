/**
 * Shared R2 storage helpers for Cloudflare Pages Functions.
 *
 * All Workers in this project import Env and these helpers rather than
 * re-implementing cache key hashing or R2 I/O individually.
 *
 * R2 keys are content-addressed (SHA-256 of the input), so they are
 * immutable — a stored value is correct forever. The image-serve endpoint
 * (functions/api/images/[key].ts) therefore sets max-age=31536000.
 */

// ---------------------------------------------------------------------------
// Duck-typed R2 interfaces — avoids @cloudflare/workers-types as a dep while
// still giving full TypeScript safety for the operations we actually perform.
// ---------------------------------------------------------------------------

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>
}

interface AIBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<{ image: string }>
}

/** Shared environment bindings declared in wrangler.toml. */
export interface Env {
  HF_TOKEN: string
  FAL_KEY: string
  IMAGES: R2BucketLike
  AI: AIBinding
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the lowercase hex SHA-256 of `input`.
 * Used to build deterministic, collision-resistant cache keys.
 */
export async function hashKey(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Fetches an object from R2.
 * Returns null on a cache miss; callers should treat null as "not found".
 */
export async function getFromR2(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.IMAGES.get(key)
}

/**
 * Stores `data` in R2 under `key` with the given content-type metadata.
 * If the same key is written twice (e.g. concurrent requests), the second
 * PUT is a safe no-op overwrite of identical content.
 */
export async function storeInR2(
  env: Env,
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await env.IMAGES.put(key, data, { httpMetadata: { contentType } })
}

/**
 * Returns the same-origin path that serves a stored R2 object.
 * This path is handled by functions/api/images/[key].ts.
 */
export function r2PublicUrl(key: string): string {
  return `/api/images/${key}`
}
