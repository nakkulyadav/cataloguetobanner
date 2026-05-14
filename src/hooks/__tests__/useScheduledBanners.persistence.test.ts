/**
 * Persistence wiring tests for useScheduledBanners — SS-15
 *
 * Separate file so we can mock persistenceService (vi.mock is hoisted per-file)
 * without affecting the existing useScheduledBanners.test.ts behaviour tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScheduledBanners } from '../useScheduledBanners'
import * as sheetsService from '@/services/sheetsService'
import * as apiService from '@/services/apiService'
import * as removeBackgroundService from '@/services/removeBackgroundService'
import * as persistenceService from '@/services/persistenceService'
import type { SheetRow, ApiCatalogItem, ApiPaginatedResponse, BannerState, PersistedScheduledEntry } from '@/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/services/sheetsService', () => ({
  fetchSheetRows: vi.fn(),
  filterRowsForDate: vi.fn(),
}))

vi.mock('@/services/apiService', () => ({
  searchCatalog: vi.fn(),
}))

vi.mock('@/services/removeBackgroundService', () => ({
  removeBackground: vi.fn(),
}))

vi.mock('@/services/imageGenerationService', () => ({
  generateAiProductImage: vi.fn(),
  resizeLogoToFit: vi.fn(),
}))

vi.mock('@/services/persistenceService', () => ({
  saveScheduledEntry: vi.fn(() => Promise.resolve()),
  loadScheduledEntry: vi.fn(() => Promise.resolve(undefined)),
  clearScheduledEntry: vi.fn(() => Promise.resolve()),
  saveEditorState: vi.fn(() => Promise.resolve()),
  loadEditorState: vi.fn(() => Promise.resolve(undefined)),
  clearEditorState: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/catalogueParser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/catalogueParser')>()
  return actual
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSheetRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    date: '3/30/2026',
    offer: 'Free delivery',
    productUrl: 'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1',
    price: '₹85',
    heading: 'Juicy Mangoes',
    subheading: 'Starting at ₹85',
    ...overrides,
  }
}

function makeApiItem(itemId = 'item-1'): ApiCatalogItem {
  return {
    id: 'api-1',
    item_id: itemId,
    item_name: 'Juicy Mangoes',
    price: 85,
    mrp: 100,
    discount_percentage: 15,
    in_stock: true,
    category: 'Grocery',
    city: 'Mumbai',
    state: 'MH',
    bpp_id: 'bpp-1',
    provider_name: 'Test Provider',
    provider_unique_id: 'test-prov-1',
    total_items: 1,
    enabled_items: 1,
    item_details: {
      descriptor: { name: 'Juicy Mangoes', images: ['https://example.com/mango.jpg'] },
      price: { value: 85, maximum_value: 100 },
    },
    provider_details: {
      id: 'prov-1',
      descriptor: { name: 'Test Brand', symbol: 'https://example.com/logo.png' },
    },
  }
}

function makeApiResponse(items: ApiCatalogItem[]): ApiPaginatedResponse<ApiCatalogItem> {
  return { data: items, total: items.length, page: 1, pageSize: 10, totalPages: 1 }
}

function makeMinimalBannerState(overrides: Partial<BannerState> = {}): BannerState {
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
    productNameOverride: 'Override Name',
    priceOverride: null,
    productImageSources: [],
    activeProductImageSourceId: null,
    logoImageSources: [],
    activeLogoImageSourceId: null,
    logoScale: 1,
    productImageScale: 1,
    quantityStickerText: null,
    showQuantitySticker: false,
    showOriginalLogo: false,
    ...overrides,
  }
}

function makePersistedEntry(overrides: Partial<PersistedScheduledEntry> = {}): PersistedScheduledEntry {
  return {
    bannerState: makeMinimalBannerState({ productNameOverride: 'Persisted Name' }),
    bgRemovedLogoUrl: 'data:image/png;base64,LOGO',
    showBgRemovedLogo: true,
    bgRemovalStatus: 'done',
    aiGenStatus: 'done',
    enhanceStatus: 'idle',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
  // Default: bg removal resolves with a fake URL
  vi.mocked(removeBackgroundService.removeBackground).mockResolvedValue('blob:http://localhost/bg-result')
  // Default: no saved persistence
  vi.mocked(persistenceService.loadScheduledEntry).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// SS-15a: saveScheduledEntry called after bg removal completes
// ---------------------------------------------------------------------------

describe('useScheduledBanners — saveScheduledEntry called after bg removal', () => {
  it('calls saveScheduledEntry after bg removal completes for an entry', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))
    await waitFor(() => expect(result.current.entries[0]?.bgRemovalStatus).toBe('done'))

    expect(persistenceService.saveScheduledEntry).toHaveBeenCalledWith(
      '2026-03-30',
      0,
      expect.objectContaining({ bgRemovalStatus: 'done' }),
    )
  })

  it('saves with the correct date and row index', async () => {
    const rowA = makeSheetRow({ heading: 'Row A' })
    const rowB = makeSheetRow({ heading: 'Row B' })
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-04-15') })

    await waitFor(() =>
      result.current.entries.every(e => e.bgRemovalStatus === 'done'),
    )

    const calls = vi.mocked(persistenceService.saveScheduledEntry).mock.calls
    const dates = calls.map(c => c[0])
    expect(dates.every(d => d === '2026-04-15')).toBe(true)

    const indices = calls.map(c => c[1])
    expect(indices).toContain(0)
    expect(indices).toContain(1)
  })
})

// ---------------------------------------------------------------------------
// SS-15b: loadScheduledEntry called for each entry after setDate()
// ---------------------------------------------------------------------------

describe('useScheduledBanners — loadScheduledEntry called after setDate', () => {
  it('calls loadScheduledEntry for each resolved entry', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    expect(persistenceService.loadScheduledEntry).toHaveBeenCalledWith('2026-03-30', 0)
  })

  it('calls loadScheduledEntry once per row for a multi-row date', async () => {
    const rows = [makeSheetRow(), makeSheetRow(), makeSheetRow()]
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue(rows)
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue(rows)
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => result.current.entries.every(e => e.status !== 'loading'))

    // One call per row
    expect(persistenceService.loadScheduledEntry).toHaveBeenCalledTimes(3)
  })

  it('merges bannerState and bgRemovedLogoUrl from persisted record into entry', async () => {
    const persisted = makePersistedEntry({
      bgRemovedLogoUrl: 'data:image/png;base64,SAVED_LOGO',
      bgRemovalStatus: 'done',
      aiGenStatus: 'done',
    })
    vi.mocked(persistenceService.loadScheduledEntry).mockResolvedValueOnce(persisted)

    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => {
      expect(result.current.entries[0]?.bgRemovedLogoUrl).toBe('data:image/png;base64,SAVED_LOGO')
    })

    const entry = result.current.entries[0]!
    expect(entry.bgRemovedLogoUrl).toBe('data:image/png;base64,SAVED_LOGO')
    expect(entry.bgRemovalStatus).toBe('done')
    expect(entry.aiGenStatus).toBe('done')
  })

  it('uses freshly-parsed sheet state when no saved record exists', async () => {
    vi.mocked(persistenceService.loadScheduledEntry).mockResolvedValue(undefined)

    const row = makeSheetRow({ heading: 'Fresh Heading' })
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const entry = result.current.entries[0]!
    // No persisted override — heading comes from the sheet row, not a saved record
    expect(entry.bannerState?.productNameOverride).toBe('Fresh Heading')
    // bgRemovedLogoUrl may be populated by auto-bg-removal which runs after load
    // What matters is that the banner state itself came from the sheet (not a saved override)
    expect(entry.bannerState?.ctaText).toBe('SHOP NOW')
  })

  it('skips auto bg-removal for entries whose saved state has bgRemovalStatus done', async () => {
    const persisted = makePersistedEntry({ bgRemovalStatus: 'done', aiGenStatus: 'idle' })
    vi.mocked(persistenceService.loadScheduledEntry).mockResolvedValueOnce(persisted)

    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => {
      const e = result.current.entries[0]
      return e?.bgRemovalStatus === 'done'
    })

    // removeBackground should NOT have been called because saved state already has done
    expect(removeBackgroundService.removeBackground).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// SS-15c: clearEntryState resets in-memory entry and calls clearScheduledEntry
// ---------------------------------------------------------------------------

describe('useScheduledBanners — clearEntryState', () => {
  it('calls clearScheduledEntry and resets bg-removal fields in-memory', async () => {
    const persisted = makePersistedEntry({ bgRemovalStatus: 'done' })
    vi.mocked(persistenceService.loadScheduledEntry).mockResolvedValueOnce(persisted)

    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.bgRemovalStatus).toBe('done'))

    const entryId = result.current.entries[0]!.id
    await act(async () => { await result.current.clearEntryState(entryId) })

    expect(persistenceService.clearScheduledEntry).toHaveBeenCalledWith('2026-03-30', 0)

    const entry = result.current.entries[0]!
    expect(entry.bgRemovalStatus).toBe('idle')
    expect(entry.bgRemovalError).toBeNull()
    expect(entry.bgRemovedLogoUrl).toBeNull()
    expect(entry.aiGenStatus).toBe('idle')
  })
})
