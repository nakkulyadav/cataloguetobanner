/**
 * Tests for persistenceService — SS-13
 *
 * Strategy: mock `idb` with a lightweight in-memory IDB-like object so we
 * test the service logic (serialisation, normalisation, key building) without
 * needing a real browser IndexedDB or fake-indexeddb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BannerState, PersistedScheduledEntry } from '@/types'

// ---------------------------------------------------------------------------
// In-memory IDB store mock
// ---------------------------------------------------------------------------

type StoreName = 'editorStates' | 'scheduledStates'

let stores: Record<StoreName, Map<string, unknown>>

function resetStores() {
  stores = {
    editorStates: new Map(),
    scheduledStates: new Map(),
  }
}

/** A minimal IDBPDatabase-like object that satisfies the service's call sites. */
function makeFakeDb() {
  return {
    put: vi.fn(async (store: StoreName, value: unknown, key: string) => {
      stores[store].set(key, value)
    }),
    get: vi.fn(async (store: StoreName, key: string) => {
      return stores[store].get(key) ?? undefined
    }),
    delete: vi.fn(async (store: StoreName, key: string) => {
      stores[store].delete(key)
    }),
    transaction: vi.fn((storeNames: StoreName[], _mode: string) => {
      const txStores: Record<string, { clear: () => Promise<void> }> = {}
      for (const name of storeNames) {
        txStores[name] = {
          clear: async () => { stores[name].clear() },
        }
      }
      return {
        objectStore: (name: StoreName) => txStores[name],
        done: Promise.resolve(),
      }
    }),
  }
}

let fakeDb: ReturnType<typeof makeFakeDb>

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(fakeDb)),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageSource(overrides = {}) {
  return {
    id: 'catalogue',
    label: 'Catalogue',
    originalUrl: 'https://example.com/img.png',
    enhancedUrl: null,
    enhancementStatus: 'idle' as const,
    bgRemovedUrl: null,
    bgRemovalStatus: 'idle' as const,
    showBgRemoved: false,
    showOriginal: false,
    source: 'catalogue' as const,
    ...overrides,
  }
}

function makeBannerState(overrides: Partial<BannerState> = {}): BannerState {
  return {
    selectedProduct: null,
    selectedBackground: null,
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: true,
    showBadge: true,
    showPrice: true,
    showLogo: true,
    showHeading: true,
    showCta: true,
    showSubheading: false,
    subheadingText: '',
    tncText: '*T&C Apply',
    brandLogoOverride: null,
    productNameOverride: null,
    priceOverride: null,
    productImageSources: [makeImageSource()],
    activeProductImageSourceId: 'catalogue',
    logoImageSources: [],
    activeLogoImageSourceId: null,
    showOriginalLogo: false,
    logoScale: 1,
    productImageScale: 1,
    quantityStickerText: null,
    showQuantitySticker: false,
    ...overrides,
  }
}

// Stub FileReader so blobUrlToDataUrl resolves in tests
function stubFileReaderWithResult(result: string) {
  const mockReader = {
    readAsDataURL: vi.fn(function (this: typeof mockReader) {
      Promise.resolve().then(() => {
        this.onload?.({ target: { result } } as unknown as ProgressEvent)
      })
    }),
    onload: null as ((e: ProgressEvent) => void) | null,
    onerror: null as ((e: ProgressEvent) => void) | null,
    result,
  }
  vi.stubGlobal('FileReader', vi.fn(() => mockReader))
}

// Stub fetch so blob: URL reads return a Blob
function stubFetchWithBlob(mimeType = 'image/png') {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('blob:')) {
      return { blob: async () => new Blob(['fake'], { type: mimeType }) }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStores()
  fakeDb = makeFakeDb()
  // Reset the dbPromise cached in the module between tests by reimporting.
  // Since vitest runs modules in isolation per file, the module-level `dbPromise`
  // persists across tests in one file — resetting fakeDb is sufficient because
  // openDB is only called once (dbPromise caches it) and our mock always returns
  // the current fakeDb reference.
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are wired up
// ---------------------------------------------------------------------------

const {
  saveEditorState,
  loadEditorState,
  clearEditorState,
  serializeBannerState,
  deserializeBannerState,
  saveScheduledEntry,
  loadScheduledEntry,
  clearAllStates,
} = await import('../persistenceService')

// ---------------------------------------------------------------------------
// serializeBannerState
// ---------------------------------------------------------------------------

describe('serializeBannerState', () => {
  it('passes https:// URLs through untouched', async () => {
    const state = makeBannerState()
    const result = await serializeBannerState(state)
    expect(result.productImageSources[0]!.originalUrl).toBe('https://example.com/img.png')
  })

  it('passes /api/images/… URLs through untouched', async () => {
    const state = makeBannerState({
      productImageSources: [makeImageSource({ originalUrl: '/api/images/abc123' })],
    })
    const result = await serializeBannerState(state)
    expect(result.productImageSources[0]!.originalUrl).toBe('/api/images/abc123')
  })

  it('converts blob: originalUrl to data URL', async () => {
    stubFetchWithBlob()
    stubFileReaderWithResult('data:image/png;base64,AABB')

    const state = makeBannerState({
      productImageSources: [makeImageSource({ originalUrl: 'blob:http://localhost/fake-img' })],
    })
    const result = await serializeBannerState(state)
    expect(result.productImageSources[0]!.originalUrl).toBe('data:image/png;base64,AABB')
  })

  it('converts blob: brandLogoOverride to data URL', async () => {
    stubFetchWithBlob()
    stubFileReaderWithResult('data:image/png;base64,LOGO')

    const state = makeBannerState({ brandLogoOverride: 'blob:http://localhost/logo' })
    const result = await serializeBannerState(state)
    expect(result.brandLogoOverride).toBe('data:image/png;base64,LOGO')
  })

  it('nulls brandLogoOverride when blob: read fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Blob revoked') }))

    const state = makeBannerState({ brandLogoOverride: 'blob:http://localhost/revoked' })
    const result = await serializeBannerState(state)
    expect(result.brandLogoOverride).toBeNull()
  })

  it('normalises bgRemovalStatus removing → idle during serialisation', async () => {
    const state = makeBannerState({
      productImageSources: [makeImageSource({ bgRemovalStatus: 'removing' })],
    })
    const result = await serializeBannerState(state)
    expect(result.productImageSources[0]!.bgRemovalStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// deserializeBannerState
// ---------------------------------------------------------------------------

describe('deserializeBannerState', () => {
  it('normalises bgRemovalStatus removing → idle', () => {
    const raw = makeBannerState({
      productImageSources: [makeImageSource({ bgRemovalStatus: 'removing' })],
    })
    const result = deserializeBannerState(raw)
    expect(result.productImageSources[0]!.bgRemovalStatus).toBe('idle')
  })

  it('normalises enhancementStatus enhancing → idle', () => {
    const raw = makeBannerState({
      productImageSources: [makeImageSource({ enhancementStatus: 'enhancing' })],
    })
    const result = deserializeBannerState(raw)
    expect(result.productImageSources[0]!.enhancementStatus).toBe('idle')
  })

  it('leaves done/error statuses untouched', () => {
    const raw = makeBannerState({
      productImageSources: [makeImageSource({ bgRemovalStatus: 'done' })],
    })
    const result = deserializeBannerState(raw)
    expect(result.productImageSources[0]!.bgRemovalStatus).toBe('done')
  })

  it('preserves all non-status fields identically', () => {
    const raw = makeBannerState({ ctaText: 'BUY NOW', logoScale: 1.5 })
    const result = deserializeBannerState(raw)
    expect(result.ctaText).toBe('BUY NOW')
    expect(result.logoScale).toBe(1.5)
  })
})

// ---------------------------------------------------------------------------
// saveEditorState + loadEditorState round-trip
// ---------------------------------------------------------------------------

describe('saveEditorState + loadEditorState', () => {
  it('round-trips a state and returns it on load', async () => {
    const state = makeBannerState({ ctaText: 'BUY NOW', logoScale: 1.4 })
    await saveEditorState('product-1', state)
    const loaded = await loadEditorState('product-1')
    expect(loaded).toBeDefined()
    expect(loaded!.ctaText).toBe('BUY NOW')
    expect(loaded!.logoScale).toBe(1.4)
  })

  it('returns undefined for a key that was never saved', async () => {
    const loaded = await loadEditorState('nonexistent')
    expect(loaded).toBeUndefined()
  })

  it('deserialises on load — normalises removing → idle', async () => {
    const state = makeBannerState({
      productImageSources: [makeImageSource({ bgRemovalStatus: 'removing' })],
    })
    // Save already normalises (serializeBannerState), but let's also confirm
    // the deserialise path runs on load by inserting raw data directly.
    stores.editorStates.set('raw-product', {
      ...state,
      productImageSources: [makeImageSource({ bgRemovalStatus: 'removing' })],
    })
    const loaded = await loadEditorState('raw-product')
    expect(loaded!.productImageSources[0]!.bgRemovalStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// clearEditorState
// ---------------------------------------------------------------------------

describe('clearEditorState', () => {
  it('removes the record; subsequent load returns undefined', async () => {
    const state = makeBannerState()
    await saveEditorState('product-clear', state)
    expect(await loadEditorState('product-clear')).toBeDefined()

    await clearEditorState('product-clear')
    expect(await loadEditorState('product-clear')).toBeUndefined()
  })

  it('is a no-op for a key that does not exist', async () => {
    await expect(clearEditorState('no-such-key')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// saveScheduledEntry + loadScheduledEntry round-trip
// ---------------------------------------------------------------------------

describe('saveScheduledEntry + loadScheduledEntry', () => {
  function makePersistedEntry(overrides: Partial<PersistedScheduledEntry> = {}): PersistedScheduledEntry {
    return {
      bannerState: makeBannerState(),
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: true,
      bgRemovalStatus: 'done',
      aiGenStatus: 'idle',
      enhanceStatus: 'idle',
      ...overrides,
    }
  }

  it('round-trips a scheduled entry', async () => {
    const entry = makePersistedEntry({ bgRemovalStatus: 'done', aiGenStatus: 'done' })
    await saveScheduledEntry('2026-03-30', 0, entry)

    const loaded = await loadScheduledEntry('2026-03-30', 0)
    expect(loaded).toBeDefined()
    expect(loaded!.bgRemovalStatus).toBe('done')
    expect(loaded!.aiGenStatus).toBe('done')
    expect(loaded!.showBgRemovedLogo).toBe(true)
  })

  it('returns undefined for a key that was never saved', async () => {
    const loaded = await loadScheduledEntry('2026-03-30', 99)
    expect(loaded).toBeUndefined()
  })

  it('normalises bgRemovalStatus removing → idle on load', async () => {
    const rawEntry: PersistedScheduledEntry & { entryKey: string } = {
      bannerState: makeBannerState(),
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: false,
      bgRemovalStatus: 'removing',
      aiGenStatus: 'idle',
      enhanceStatus: 'idle',
      entryKey: '2026-03-30:2',
    }
    stores.scheduledStates.set('2026-03-30:2', rawEntry)

    const loaded = await loadScheduledEntry('2026-03-30', 2)
    expect(loaded!.bgRemovalStatus).toBe('idle')
  })

  it('normalises aiGenStatus generating → idle on load', async () => {
    const rawEntry: PersistedScheduledEntry & { entryKey: string } = {
      bannerState: makeBannerState(),
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: false,
      bgRemovalStatus: 'idle',
      aiGenStatus: 'generating',
      enhanceStatus: 'idle',
      entryKey: '2026-03-30:3',
    }
    stores.scheduledStates.set('2026-03-30:3', rawEntry)

    const loaded = await loadScheduledEntry('2026-03-30', 3)
    expect(loaded!.aiGenStatus).toBe('idle')
  })

  it('merging persisted fields over a fresh entry produces correct combined object', async () => {
    const persisted = makePersistedEntry({
      bgRemovedLogoUrl: 'data:image/png;base64,LOGO',
      bgRemovalStatus: 'done',
      aiGenStatus: 'done',
    })
    await saveScheduledEntry('2026-03-30', 1, persisted)

    const fresh = {
      id: 'sb-2026-03-30-1',
      sheetRow: { date: '3/30/2026', offer: '', productUrl: '', price: '', heading: '', subheading: '' },
      status: 'ready' as const,
      bannerState: makeBannerState({ ctaText: 'SHOP NOW' }),
      error: null,
      bgRemovalStatus: 'idle' as const,
      bgRemovalError: null,
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: true,
      aiGenStatus: 'idle' as const,
      aiGenError: null,
    }

    const saved = await loadScheduledEntry('2026-03-30', 1)
    const merged = {
      ...fresh,
      bannerState: saved!.bannerState ?? fresh.bannerState,
      bgRemovedLogoUrl: saved!.bgRemovedLogoUrl,
      bgRemovalStatus: saved!.bgRemovalStatus,
      aiGenStatus: saved!.aiGenStatus,
    }

    expect(merged.bgRemovedLogoUrl).toBe('data:image/png;base64,LOGO')
    expect(merged.bgRemovalStatus).toBe('done')
    expect(merged.aiGenStatus).toBe('done')
    // Fresh fields not in persisted entry remain intact
    expect(merged.id).toBe('sb-2026-03-30-1')
  })
})

// ---------------------------------------------------------------------------
// clearAllStates
// ---------------------------------------------------------------------------

describe('clearAllStates', () => {
  it('empties both stores', async () => {
    await saveEditorState('prod-1', makeBannerState())
    const entry: PersistedScheduledEntry = {
      bannerState: makeBannerState(),
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: true,
      bgRemovalStatus: 'idle',
      aiGenStatus: 'idle',
      enhanceStatus: 'idle',
    }
    await saveScheduledEntry('2026-03-30', 0, entry)

    expect(stores.editorStates.size).toBeGreaterThan(0)
    expect(stores.scheduledStates.size).toBeGreaterThan(0)

    await clearAllStates()

    expect(stores.editorStates.size).toBe(0)
    expect(stores.scheduledStates.size).toBe(0)
  })
})
