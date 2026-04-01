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
  extractProductUrl: vi.fn(),
  extractPrice: vi.fn(),
  parseComments: vi.fn(),
}))

vi.mock('@/services/apiService', () => ({
  searchCatalog: vi.fn(),
}))

vi.mock('@/services/removeBackgroundService', () => ({
  removeBackground: vi.fn(),
}))

// catalogueParser.parseApiItems is called internally — use a real minimal impl
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
    team: 'bazar page',
    page: 'Banner',
    offerCallout: 'Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1',
    comments: 'Header: Juicy Mangoes\nSubheader: Starting at ₹85',
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
    // resetAllMocks clears both call history AND mock implementations so that
    // stale .mockReturnValue() chains from one test never bleed into the next.
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
    // fetchSheetRows never resolves during this check
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
    expect(result.current.fetchError).toMatch(/No Bazar Page banners/)
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
    vi.mocked(sheetsService.extractProductUrl).mockReturnValue(
      'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1'
    )
    vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
    vi.mocked(sheetsService.parseComments).mockReturnValue({ heading: 'Juicy Mangoes', subheading: 'Starting at ₹85' })
    // API never resolves — entries stay in loading state
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
    vi.mocked(sheetsService.extractProductUrl).mockReturnValue(
      'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1'
    )
    vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
    vi.mocked(sheetsService.parseComments).mockReturnValue({ heading: 'Juicy Mangoes', subheading: 'Starting at ₹85' })
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

  it('sets entry to error when no URL is found in offer callout', async () => {
    const row = makeSheetRow({ offerCallout: 'Our price - 85 + Free delivery' })
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(sheetsService.extractProductUrl).mockReturnValue(null)

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('error'))
    expect(result.current.entries[0]!.error).toMatch(/No product URL/)
  })

  it('sets entry to error when catalogue API returns no results', async () => {
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(sheetsService.extractProductUrl).mockReturnValue(
      'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1'
    )
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('error'))
    expect(result.current.entries[0]!.error).toMatch(/not found/)
  })

  it('handles multiple rows — ready and error can coexist', async () => {
    const rowA = makeSheetRow({ comments: 'Header: Mangoes\nSubheader: Fresh' })
    const rowB = makeSheetRow({ offerCallout: 'No URL here' })

    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(sheetsService.extractProductUrl)
      .mockReturnValueOnce('https://digihaat.in/en/product?item_id=item-1&bpp_id=x&domain=y&provider_id=z')
      .mockReturnValueOnce(null)
    vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
    vi.mocked(sheetsService.parseComments).mockReturnValue({ heading: 'Mangoes', subheading: 'Fresh' })
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })

    // Use expect() inside waitFor so it retries on failure — a plain boolean
    // return value does NOT cause waitFor to retry, only thrown errors do.
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

    // Change date — entries should clear immediately
    act(() => { result.current.setDate('2026-03-31') })
    expect(result.current.entries).toHaveLength(0)
    expect(result.current.fetchError).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ES-6: updateEntryState
// ---------------------------------------------------------------------------

describe('updateEntryState', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Helper: bring the hook to a state where at least one entry is 'ready'
   * by wiring all mocks for a successful two-row fetch.
   */
  async function setupTwoReadyEntries() {
    const rowA = makeSheetRow({ comments: 'Header: Mangoes\nSubheader: Fresh' })
    const rowB = makeSheetRow({ comments: 'Header: Apples\nSubheader: Crisp' })

    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(sheetsService.extractProductUrl)
      .mockReturnValue('https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1')
    vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
    vi.mocked(sheetsService.parseComments)
      .mockReturnValueOnce({ heading: 'Mangoes', subheading: 'Fresh' })
      .mockReturnValueOnce({ heading: 'Apples', subheading: 'Crisp' })
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
  }

  it('ES-6a: patches only the target entry bannerState; other entries are unchanged', async () => {
    await setupTwoReadyEntries()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    // Wait for both entries to finish resolving — must check length first so
    // that [].every(...) true does not cause early exit with an empty array.
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.every(e => e.status === 'ready')).toBe(true)
    })

    const [entryA, entryB] = result.current.entries
    const originalB = entryB!.bannerState

    // Build a new state that differs clearly from the original
    const newState = { ...entryA!.bannerState!, ctaText: 'BUY NOW' }

    act(() => { result.current.updateEntryState(entryA!.id, newState) })

    // Target entry gets the new state
    expect(result.current.entries[0]!.bannerState?.ctaText).toBe('BUY NOW')
    // Sibling entry is untouched
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

    // Call with a non-existent id — should not throw and should not mutate
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
// removeEntryBackground — brand logo support (BL)
// ---------------------------------------------------------------------------

/** Shared setup: one ready entry with a product image and brand logo */
function setupReadyEntry() {
  const row = makeSheetRow()
  vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
  vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
  vi.mocked(sheetsService.extractProductUrl).mockReturnValue(
    'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1',
  )
  vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
  vi.mocked(sheetsService.parseComments).mockReturnValue({ heading: 'Juicy Mangoes', subheading: 'Starting at ₹85' })
  vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))
}

describe('removeEntryBackground — logo support (BL)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // jsdom does not implement URL.revokeObjectURL — stub it so the hook
    // doesn't throw when it tries to revoke old blob URLs.
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('BL-2: stores bg-removed URLs in dedicated fields after successful removal', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockResolvedValueOnce('blob:logo-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    // IT-3: stored in dedicated fields, NOT injected into bannerState
    expect(entry.bgRemovedProductImageUrl).toBe('blob:product-result')
    expect(entry.bgRemovedLogoUrl).toBe('blob:logo-result')
    expect(entry.bgRemovalStatus).toBe('done')
    expect(entry.bgRemovalError).toBeNull()
  })

  it('BL-2: stores new logo blob URL in bgRemovedLogoUrl when replaced', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockResolvedValueOnce('blob:logo-result-new')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    // The dedicated field holds the new blob URL; bannerState is untouched
    expect(result.current.entries[0]!.bgRemovedLogoUrl).toBe('blob:logo-result-new')
    expect(result.current.entries[0]!.bannerState?.brandLogoOverride).toBeNull()
  })

  it('BL-3: marks entry done with error note when logo removal fails but product image succeeds', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockRejectedValueOnce(new Error('Logo fetch failed'))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    // Product bg-removed URL stored in dedicated field; bannerState untouched
    expect(entry.bgRemovedProductImageUrl).toBe('blob:product-result')
    expect(entry.bannerState?.productImageOverride).toBeNull()
    // Status is 'done' — user is not blocked
    expect(entry.bgRemovalStatus).toBe('done')
    // Error note appended
    expect(entry.bgRemovalError).toBe('Product bg: ok | Logo bg: Logo fetch failed')
  })

  it('BL edge case: skips logo step silently when product has no brand logo', async () => {
    const itemWithNoLogo = makeApiItem('item-1')
    itemWithNoLogo.provider_details = {
      id: 'prov-1',
      descriptor: { name: 'Test Brand', symbol: '' },
    }
    const row = makeSheetRow()
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([row])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([row])
    vi.mocked(sheetsService.extractProductUrl).mockReturnValue(
      'https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1',
    )
    vi.mocked(sheetsService.extractPrice).mockReturnValue(null)
    vi.mocked(sheetsService.parseComments).mockReturnValue({ heading: '', subheading: '' })
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([itemWithNoLogo]))
    vi.mocked(removeBackgroundService.removeBackground).mockResolvedValueOnce('blob:product-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    expect(entry.bgRemovalStatus).toBe('done')
    expect(entry.bgRemovalError).toBeNull()
    // removeBackground called exactly once (only product image, not logo)
    expect(vi.mocked(removeBackgroundService.removeBackground)).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// IT-18 / IT-19 / IT-20 — bg-removed URL separation, toggle, and date revocation
// ---------------------------------------------------------------------------

describe('IT-3/IT-4/IT-5 — bg-removed URL fields, toggle, and date cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // IT-18: removeEntryBackground stores results in dedicated fields; bannerState overrides stay null
  it('IT-18: bgRemovedProductImageUrl and bgRemovedLogoUrl are set; bannerState overrides remain null', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockResolvedValueOnce('blob:logo-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    const entry = result.current.entries[0]!
    // IT-3: stored in dedicated fields, NOT injected into bannerState
    expect(entry.bgRemovedProductImageUrl).toBe('blob:product-result')
    expect(entry.bgRemovedLogoUrl).toBe('blob:logo-result')
    // bannerState source-of-truth untouched
    expect(entry.bannerState?.productImageOverride).toBeNull()
    expect(entry.bannerState?.brandLogoOverride).toBeNull()
  })

  // IT-19a: toggleEntryBgRemovedProduct flips showBgRemovedProduct on target; siblings unaffected
  it('IT-19a: toggleEntryBgRemovedProduct flips showBgRemovedProduct on target entry only', async () => {
    const rowA = makeSheetRow({ comments: 'Header: Mangoes\nSubheader: Fresh' })
    const rowB = makeSheetRow({ comments: 'Header: Apples\nSubheader: Crisp' })

    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([rowA, rowB])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([rowA, rowB])
    vi.mocked(sheetsService.extractProductUrl)
      .mockReturnValue('https://digihaat.in/en/product?item_id=item-1&bpp_id=bpp-1&domain=ONDC%3ARET10&provider_id=prov-1')
    vi.mocked(sheetsService.extractPrice).mockReturnValue('₹85')
    vi.mocked(sheetsService.parseComments)
      .mockReturnValueOnce({ heading: 'Mangoes', subheading: 'Fresh' })
      .mockReturnValueOnce({ heading: 'Apples', subheading: 'Crisp' })
    vi.mocked(apiService.searchCatalog).mockResolvedValue(makeApiResponse([makeApiItem('item-1')]))

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries.every(e => e.status === 'ready')).toBe(true)
    })

    const [entryA, entryB] = result.current.entries
    const originalBValue = entryB!.showBgRemovedProduct

    // All entries start with showBgRemovedProduct: true (per hook init)
    expect(entryA!.showBgRemovedProduct).toBe(true)

    act(() => { result.current.toggleEntryBgRemovedProduct(entryA!.id) })

    expect(result.current.entries[0]!.showBgRemovedProduct).toBe(false)
    // Sibling entry is untouched
    expect(result.current.entries[1]!.showBgRemovedProduct).toBe(originalBValue)
  })

  // IT-19b: calling toggleEntryBgRemovedProduct twice returns to original value
  it('IT-19b: toggleEntryBgRemovedProduct twice returns to original showBgRemovedProduct', async () => {
    setupReadyEntry()

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    const original = result.current.entries[0]!.showBgRemovedProduct

    act(() => { result.current.toggleEntryBgRemovedProduct(result.current.entries[0]!.id) })
    act(() => { result.current.toggleEntryBgRemovedProduct(result.current.entries[0]!.id) })

    expect(result.current.entries[0]!.showBgRemovedProduct).toBe(original)
  })

  // IT-20: changing date revokes blob URLs from bgRemovedProductImageUrl and bgRemovedLogoUrl
  it('IT-20: setDate revokes bgRemovedProductImageUrl and bgRemovedLogoUrl blob URLs from previous entries', async () => {
    setupReadyEntry()
    vi.mocked(removeBackgroundService.removeBackground)
      .mockResolvedValueOnce('blob:product-result')
      .mockResolvedValueOnce('blob:logo-result')

    const { result } = renderHook(() => useScheduledBanners())
    act(() => { result.current.setDate('2026-03-30') })
    await waitFor(() => expect(result.current.entries[0]?.status).toBe('ready'))

    await act(async () => { await result.current.removeEntryBackground(result.current.entries[0]!.id) })

    // Verify blob URLs are stored before date change
    expect(result.current.entries[0]!.bgRemovedProductImageUrl).toBe('blob:product-result')
    expect(result.current.entries[0]!.bgRemovedLogoUrl).toBe('blob:logo-result')

    // Reset mocks for the new date fetch (returns empty — just triggers the cleanup path)
    vi.mocked(sheetsService.fetchSheetRows).mockResolvedValue([])
    vi.mocked(sheetsService.filterRowsForDate).mockReturnValue([])

    act(() => { result.current.setDate('2026-03-31') })

    // Both blob URLs should have been revoked
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:product-result')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logo-result')
    // Entries are cleared
    expect(result.current.entries).toHaveLength(0)
  })
})
