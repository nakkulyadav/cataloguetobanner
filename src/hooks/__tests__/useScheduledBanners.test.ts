import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScheduledBanners } from '../useScheduledBanners'
import * as sheetsService from '@/services/sheetsService'
import * as apiService from '@/services/apiService'
import * as removeBackgroundService from '@/services/removeBackgroundService'
import type { SheetRow, ApiCatalogItem, ApiPaginatedResponse } from '@/types'

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useScheduledBanners', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initialises with empty state', () => {
    const { result } = renderHook(() => useScheduledBanners())
    expect(result.current.selectedDate).toBe('')
    expect(result.current.isFetching).toBe(false)
    expect(result.current.fetchError).toBeNull()
    expect(result.current.entries).toHaveLength(0)
  })

  it('does nothing when date is cleared (empty string)', async () => {
    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('') })
    expect(result.current.isFetching).toBe(false)
    expect(result.current.entries).toHaveLength(0)
  })

  it('sets isFetching=true while sheet is loading', async () => {
    vi.mocked(sheetsService.fetchSheetRows).mockReturnValue(new Promise(() => {}))
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([])

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    expect(result.current.isFetching).toBe(true)
  })

  it('sets fetchError when no rows match the date', async () => {
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([makeSheetRow()])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([])

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.fetchError).toMatch(/No banners/)
    expect(result.current.entries).toHaveLength(0)
  })

  it('sets fetchError when sheet fetch fails', async () => {
    vi.mocked(sheetsService.fetchSheetRows).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.fetchError).toMatch(/Network error/)
  })

  it('initialises entries in loading state immediately after sheet fetch', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.entries[0]!.status).toBe('loading')
    expect(result.current.entries[0]!.bannerState).toBeNull()
  })

  it('transitions entry to ready with merged overrides on successful lookup', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const entry = result.current.entries[0]!
    expect(entry.bannerState).not.toBeNull()
    expect(entry.bannerState?.productNameOverride).toBe('Juicy Mangoes')
    expect(entry.bannerState?.showSubheading).toBe(true)
    expect(entry.bannerState?.subheadingText).toBe('Starting at ₹85')
    expect(entry.bannerState?.priceOverride).toEqual({ mrp: '₹100', sellingPrice: '₹85' })
    expect(entry.bannerState?.selectedProduct?.id).toBe('item-1')
  })

  it('sets entry to error when no URL is present in the row', async () => {
    const row = makeSheetRow({ productUrl: '' })
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('error'))
    expect(result.current.entries[0]!.error).toMatch(/No product URL/)
  })

  it('sets entry to error when catalogue API returns no results', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('error'))
    expect(result.current.entries[0]!.error).toMatch(/not found/)
  })

  it('handles multiple rows — ready and error can coexist', async () => {
    const rowA = makeSheetRow({ heading: 'Mangoes', subheading: 'Fresh' })
    const rowB = makeSheetRow({ productUrl: '' })

    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0)
      expect(result.current.entries.every(e => e.status !== 'loading')).toBe(true)
    })

    const statuses = result.current.entries.map(e => e.status)
    expect(statuses).toContain('ready')
    expect(statuses).toContain('error')
  })

  it('clears entries when date is changed', async () => {
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([])

    const { result } = renderHook(() => useScheduledBanners())

    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    act(() => { result.current.setDate('2026-03-31') })
    expect(result.current.entries).toHaveLength(0)
    expect(result.current.fetchError).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ISL-9b: resolveEntry initialises productImageSources
// ---------------------------------------------------------------------------

describe('ISL: resolveEntry initialises productImageSources', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('creates catalogue source with idle status when product has imageUrl', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const bs = result.current.entries[0]!.bannerState!
    expect(bs.productImageSources).toHaveLength(1)
    expect(bs.productImageSources[0]!.id).toBe('catalogue')
    expect(bs.productImageSources[0]!.source).toBe('catalogue')
    expect(bs.productImageSources[0]!.originalUrl).toBe('https://example.com/mango.jpg')
    // bgRemovalStatus starts as 'idle' but auto-removal runs immediately in tests
    expect(['idle', 'removing', 'done', 'error']).toContain(bs.productImageSources[0]!.bgRemovalStatus)
    expect(bs.activeProductImageSourceId).toBe('catalogue')
  })

  it('leaves productImageSources empty when product has no imageUrl', async () => {
    const itemNoImg = makeApiItem('item-1')
    itemNoImg.item_details.descriptor.images = []
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([itemNoImg]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const bs = result.current.entries[0]!.bannerState!
    expect(bs.productImageSources).toEqual([])
    expect(bs.activeProductImageSourceId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// QST-12: resolveEntry — quantity sticker defaults (not from sheet)
// ---------------------------------------------------------------------------

describe('QST-12: resolveEntry — quantity sticker defaults', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('always sets quantityStickerText=null and showQuantitySticker=false (sheet has no sticker column)', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
    vi.mocked(removeBackgroundService.removeBackground).mockResolvedValue('blob:removed')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const bs = result.current.entries[0]!.bannerState!
    expect(bs.quantityStickerText).toBeNull()
    expect(bs.showQuantitySticker).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ISL-9b: removeEntryBackground iterates sources
// ---------------------------------------------------------------------------

describe('ISL: removeEntryBackground — per-source processing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => { vi.restoreAllMocks() })

  function setupReadyEntry() {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('sets bgRemovedUrl + done + showBgRemoved:true on catalogue source after removal', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockResolvedValueOnce('blob:logo-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    const catSrc = entry.bannerState?.productImageSources.find(s => s.id === 'catalogue')!
    expect(catSrc.bgRemovedUrl).toBe('blob:product-result')
    expect(catSrc.bgRemovalStatus).toBe('done')
    expect(catSrc.showBgRemoved).toBe(true)
    expect(entry.bgRemovedLogoUrl).toBe('blob:logo-result')
    expect(entry.bgRemovalStatus).toBe('done')
  })

  it('marks source error when product bg removal fails; entry status is still done', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('blob:logo-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    const catSrc = entry.bannerState?.productImageSources.find(s => s.id === 'catalogue')!
    expect(catSrc.bgRemovalStatus).toBe('error')
    expect(catSrc.bgRemovedUrl).toBeNull()
    expect(entry.bgRemovalStatus).toBe('done')
  })

  it('marks entry done with error note when logo removal fails', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockRejectedValueOnce(new Error('Logo fetch failed'))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    expect(entry.bgRemovalStatus).toBe('done')
    expect(entry.bgRemovalError).toBe('Product bg: ok | Logo bg: Logo fetch failed')
  })
})

// ---------------------------------------------------------------------------
// ISL-9b: toggleEntrySourceBgRemoved + setEntryActiveSource
// ---------------------------------------------------------------------------

describe('ISL: toggleEntrySourceBgRemoved and setEntryActiveSource', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  function setupReadyEntry() {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('toggleEntrySourceBgRemoved flips showBgRemoved on the target source only', async () => {
    setupReadyEntry()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const before = result.current.entries[0]!.bannerState!.productImageSources[0]!.showBgRemoved

    act(() => {
      result.current.toggleEntrySourceBgRemoved(result.current.entries[0]!.id, 'catalogue')
    })

    expect(result.current.entries[0]!.bannerState!.productImageSources[0]!.showBgRemoved).toBe(!before)
  })

  it('setEntryActiveSource updates activeProductImageSourceId on the matching entry', async () => {
    setupReadyEntry()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    act(() => {
      result.current.setEntryActiveSource(result.current.entries[0]!.id, 'catalogue')
    })

    expect(result.current.entries[0]!.bannerState!.activeProductImageSourceId).toBe('catalogue')
  })
})

// ---------------------------------------------------------------------------
// ES-6: updateEntryState
// ---------------------------------------------------------------------------

describe('updateEntryState', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  async function setupTwoReadyEntries() {
    const rowA = makeSheetRow({ heading: 'Mangoes', subheading: 'Fresh' })
    const rowB = makeSheetRow({ heading: 'Apples', subheading: 'Crisp' })

    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('ES-6a: patches only the target entry bannerState; other entries are unchanged', async () => {
    await setupTwoReadyEntries()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.every(e => e.status === 'ready')).toBe(true)
    })

    const [entryA, entryB] = result.current.entries
    const originalB = entryB!.bannerState

    const newState = { ...entryA!.bannerState!, ctaText: 'BUY NOW' }
    act(() => { result.current.updateEntryState(entryA!.id, newState) })

    expect(result.current.entries[0]!.bannerState?.ctaText).toBe('BUY NOW')
    expect(result.current.entries[1]!.bannerState).toBe(originalB)
  })

  it('ES-6b: no-ops silently when id does not match any entry', async () => {
    await setupTwoReadyEntries()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.every(e => e.status === 'ready')).toBe(true)
    })

    const originalEntries = result.current.entries.map(e => e.bannerState)

    act(() => {
      result.current.updateEntryState(
        'non-existent-id',
        { ...result.current.entries[0]!.bannerState!, ctaText: 'CHANGED' },
      )
    })

    result.current.entries.forEach((e, i) => {
      expect(e.bannerState).toBe(originalEntries[i])
    })
  })
})

// ---------------------------------------------------------------------------
// Logo toggle
// ---------------------------------------------------------------------------

describe('toggleEntryBgRemovedLogo', () => {
  beforeEach(() => { vi.resetAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  function setupReadyEntry() {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('flips showBgRemovedLogo on the target entry only', async () => {
    setupReadyEntry()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const original = result.current.entries[0]!.showBgRemovedLogo
    act(() => { result.current.toggleEntryBgRemovedLogo(result.current.entries[0]!.id) })
    expect(result.current.entries[0]!.showBgRemovedLogo).toBe(!original)
  })
})

// ---------------------------------------------------------------------------
// Date cleanup — blob URL revocation
// ---------------------------------------------------------------------------

describe('setDate — blob URL revocation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('clears entries when date changes (bgRemoved R2 URLs are stable — not revoked)', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('/api/images/product-key')
      .mockResolvedValueOnce('/api/images/logo-key')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))
    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    // Confirm R2 URLs are stored
    const catSrc = result.current.entries[0]!.bannerState!.productImageSources[0]!
    expect(catSrc.bgRemovedUrl).toBe('/api/images/product-key')
    expect(result.current.entries[0]!.bgRemovedLogoUrl).toBe('/api/images/logo-key')

    // Change date — entries are cleared; stable R2 URLs are not revoked
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([])
    act(() => { result.current.setDate('2026-03-31') })

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('/api/images/product-key')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('/api/images/logo-key')
    expect(result.current.entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// ABR-7 — auto background removal triggered by setDate
// ---------------------------------------------------------------------------

describe('ABR-7 — auto background removal on setDate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function setupTwoReadyRows() {
    const rowA = makeSheetRow()
    const rowB = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('ABR-7a: processes all ready entries; sources get bgRemovedUrl; logo stored in entry', async () => {
    setupTwoReadyRows()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:entry1-product')
      .mockResolvedValueOnce('blob:entry1-logo')
      .mockResolvedValueOnce('blob:entry2-product')
      .mockResolvedValueOnce('blob:entry2-logo')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.every(e => e.bgRemovalStatus === 'done')).toBe(true)
    })

    expect(vi.mocked(removeBackgroundService.removeBackground)).toHaveBeenCalledTimes(4)
    const src1 = result.current.entries[0]!.bannerState!.productImageSources[0]!
    const src2 = result.current.entries[1]!.bannerState!.productImageSources[0]!
    expect(src1.bgRemovedUrl).toBe('blob:entry1-product')
    expect(src2.bgRemovedUrl).toBe('blob:entry2-product')
    expect(result.current.entries[0]!.bgRemovedLogoUrl).toBe('blob:entry1-logo')
    expect(result.current.entries[1]!.bgRemovedLogoUrl).toBe('blob:entry2-logo')
  })

  it('ABR-7b: date change mid-loop prevents subsequent entries from being processed', async () => {
    setupTwoReadyRows()

    let signalInFlight!: () => void
    const inFlightPromise = new Promise<void>(res => { signalInFlight = res })

    let resolveFirst!: (url: string) => void
    const firstCallPromise = new Promise<string>(res => { resolveFirst = res })

    vi.mocked(removeBackgroundService.removeBackground)
      .mockImplementationOnce(async () => {
        signalInFlight()
        return firstCallPromise
      })
      .mockResolvedValue('blob:other')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await inFlightPromise

    vi.mocked(sheetsService.fetchSheetRows).mockReturnValue(new Promise(() => {}))
    act(() => { result.current.setDate('2026-03-31') })

    await act(async () => { resolveFirst('blob:entry1-product') })

    expect(vi.mocked(removeBackgroundService.removeBackground)).toHaveBeenCalledTimes(1)
  })
})
