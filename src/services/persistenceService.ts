/**
 * persistenceService — IndexedDB-backed banner state persistence.
 *
 * Two object stores:
 *   editorStates     keyed by productId  → BannerState for the single-banner editor
 *   scheduledStates  keyed by entryKey   → PersistedScheduledEntry for scheduled banners
 *
 * All image data is stored as stable data URLs or remote URLs; session-only
 * blob: URLs are converted to data URLs before writing so they survive page reloads.
 * Transient processing status fields are normalised to 'idle' on read so no entry
 * is stuck in a phantom 'loading' / 'removing' state after a refresh.
 */

import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import type { BannerState, ImageSource, PersistedScheduledEntry } from '@/types'

// ---------------------------------------------------------------------------
// DB schema
// ---------------------------------------------------------------------------

const DB_NAME = 'digihaat-banners'
const DB_VERSION = 1

interface BannerDB {
  editorStates: {
    key: string
    value: BannerState
  }
  scheduledStates: {
    key: string
    value: PersistedScheduledEntry & { entryKey: string }
  }
}

let dbPromise: Promise<IDBPDatabase<BannerDB>> | null = null

function getDb(): Promise<IDBPDatabase<BannerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('editorStates')) {
          db.createObjectStore('editorStates')
        }
        if (!db.objectStoreNames.contains('scheduledStates')) {
          db.createObjectStore('scheduledStates')
        }
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// Blob URL serialisation helpers (SS-3)
// ---------------------------------------------------------------------------

/**
 * Reads a blob: URL and returns a data URL (base64-encoded).
 * Throws if the blob has already been revoked.
 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl)
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Serialises a single ImageSource — converts any blob: URL fields
 * (originalUrl, bgRemovedUrl) to data URLs so they survive page reloads.
 * Errors per-source are silently absorbed; the original source is returned
 * on failure so the caller can still save the rest of the state.
 */
async function serializeImageSource(source: ImageSource): Promise<ImageSource> {
  let originalUrl = source.originalUrl
  let bgRemovedUrl = source.bgRemovedUrl
  let enhancedUrl = source.enhancedUrl

  try {
    if (originalUrl.startsWith('blob:')) {
      originalUrl = await blobUrlToDataUrl(originalUrl)
    }
  } catch {
    // Blob already revoked — drop this source's original URL by keeping it
    // as the original blob: reference; the restored image will be broken,
    // which is acceptable since the user can re-upload.
    console.warn('[persistenceService] blob: URL already revoked for source', source.id)
  }

  try {
    if (bgRemovedUrl?.startsWith('blob:')) {
      bgRemovedUrl = await blobUrlToDataUrl(bgRemovedUrl)
    }
  } catch {
    bgRemovedUrl = null
  }

  try {
    if (enhancedUrl?.startsWith('blob:')) {
      enhancedUrl = await blobUrlToDataUrl(enhancedUrl)
    }
  } catch {
    enhancedUrl = null
  }

  return {
    ...source,
    originalUrl,
    bgRemovedUrl,
    enhancedUrl,
    // Normalise any in-flight status — the worker is gone after a refresh.
    bgRemovalStatus: source.bgRemovalStatus === 'removing' ? 'idle' : source.bgRemovalStatus,
    enhancementStatus: source.enhancementStatus === 'enhancing' ? 'idle' : source.enhancementStatus,
  }
}

/**
 * Serialises a BannerState for storage:
 *   - Converts blob: URLs in productImageSources and logoImageSources to data URLs.
 *   - brandLogoOverride blob: URLs are also converted.
 * Returns a new state object; does NOT mutate the live React state.
 */
export async function serializeBannerState(state: BannerState): Promise<BannerState> {
  const [productImageSources, logoImageSources] = await Promise.all([
    Promise.all(state.productImageSources.map(serializeImageSource)),
    Promise.all(state.logoImageSources.map(serializeImageSource)),
  ])

  let brandLogoOverride = state.brandLogoOverride
  try {
    if (brandLogoOverride?.startsWith('blob:')) {
      brandLogoOverride = await blobUrlToDataUrl(brandLogoOverride)
    }
  } catch {
    brandLogoOverride = null
  }

  return { ...state, productImageSources, logoImageSources, brandLogoOverride }
}

// ---------------------------------------------------------------------------
// Deserialisation helpers (SS-4)
// ---------------------------------------------------------------------------

/**
 * Normalises an ImageSource read from IndexedDB.
 * Any 'removing' / 'enhancing' status (which would imply a live worker) is
 * reset to 'idle' so the UI shows the correct idle state after page reload.
 */
function deserializeImageSource(source: ImageSource): ImageSource {
  return {
    ...source,
    bgRemovalStatus: source.bgRemovalStatus === 'removing' ? 'idle' : source.bgRemovalStatus,
    enhancementStatus: source.enhancementStatus === 'enhancing' ? 'idle' : source.enhancementStatus,
  }
}

/**
 * Deserialises a BannerState read from IndexedDB.
 * Normalises all transient status fields so no source is stuck in 'removing'.
 */
export function deserializeBannerState(raw: BannerState): BannerState {
  return {
    ...raw,
    productImageSources: raw.productImageSources.map(deserializeImageSource),
    logoImageSources: raw.logoImageSources.map(deserializeImageSource),
  }
}

// ---------------------------------------------------------------------------
// Editor state — single-banner editor (SS-2)
// ---------------------------------------------------------------------------

/** Persists the single-editor banner state for a given product ID. */
export async function saveEditorState(productId: string, state: BannerState): Promise<void> {
  try {
    const serialised = await serializeBannerState(state)
    const db = await getDb()
    await db.put('editorStates', serialised, productId)
  } catch (err) {
    // QuotaExceededError or other IDB failures must not crash the UI.
    console.warn('[persistenceService] saveEditorState failed:', err)
  }
}

/** Returns the persisted banner state for a product ID, or undefined if none exists. */
export async function loadEditorState(productId: string): Promise<BannerState | undefined> {
  try {
    const db = await getDb()
    const raw = await db.get('editorStates', productId)
    return raw ? deserializeBannerState(raw) : undefined
  } catch (err) {
    console.warn('[persistenceService] loadEditorState failed:', err)
    return undefined
  }
}

/** Removes the persisted state for a product ID (called by "Reset to default"). */
export async function clearEditorState(productId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('editorStates', productId)
  } catch (err) {
    console.warn('[persistenceService] clearEditorState failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Scheduled entry state (SS-2)
// ---------------------------------------------------------------------------

function scheduledKey(date: string, sheetRowIndex: number): string {
  return `${date}:${sheetRowIndex}`
}

/** Persists the state for a single scheduled banner entry. */
export async function saveScheduledEntry(
  date: string,
  sheetRowIndex: number,
  entry: PersistedScheduledEntry,
): Promise<void> {
  try {
    const key = scheduledKey(date, sheetRowIndex)

    // Serialise any blob: URLs inside bannerState
    const serialisedBannerState = entry.bannerState
      ? await serializeBannerState(entry.bannerState)
      : null

    // Serialise bgRemovedLogoUrl if it's a blob:
    let bgRemovedLogoUrl = entry.bgRemovedLogoUrl
    try {
      if (bgRemovedLogoUrl?.startsWith('blob:')) {
        bgRemovedLogoUrl = await blobUrlToDataUrl(bgRemovedLogoUrl)
      }
    } catch {
      bgRemovedLogoUrl = null
    }

    const db = await getDb()
    await db.put(
      'scheduledStates',
      { ...entry, bannerState: serialisedBannerState, bgRemovedLogoUrl, entryKey: key },
      key,
    )
  } catch (err) {
    console.warn('[persistenceService] saveScheduledEntry failed:', err)
  }
}

/** Returns the persisted scheduled entry, or undefined if none exists. */
export async function loadScheduledEntry(
  date: string,
  sheetRowIndex: number,
): Promise<PersistedScheduledEntry | undefined> {
  try {
    const db = await getDb()
    const raw = await db.get('scheduledStates', scheduledKey(date, sheetRowIndex))
    if (!raw) return undefined

    return {
      ...raw,
      bannerState: raw.bannerState ? deserializeBannerState(raw.bannerState) : null,
      // Normalise lifecycle statuses — these workers are gone after a refresh.
      bgRemovalStatus: raw.bgRemovalStatus === 'removing' ? 'idle' : raw.bgRemovalStatus,
      aiGenStatus: raw.aiGenStatus === 'generating' ? 'idle' : raw.aiGenStatus,
    }
  } catch (err) {
    console.warn('[persistenceService] loadScheduledEntry failed:', err)
    return undefined
  }
}

/** Removes the persisted state for a single scheduled entry. */
export async function clearScheduledEntry(date: string, sheetRowIndex: number): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('scheduledStates', scheduledKey(date, sheetRowIndex))
  } catch (err) {
    console.warn('[persistenceService] clearScheduledEntry failed:', err)
  }
}

/** Wipes all data from both object stores. */
export async function clearAllStates(): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(['editorStates', 'scheduledStates'], 'readwrite')
    await Promise.all([tx.objectStore('editorStates').clear(), tx.objectStore('scheduledStates').clear()])
    await tx.done
  } catch (err) {
    console.warn('[persistenceService] clearAllStates failed:', err)
  }
}
