/**
 * Persistence wiring tests for useBannerState — SS-14
 *
 * Separate file from useBannerState.test.tsx so we can mock persistenceService
 * without affecting the other tests (vi.mock is hoisted per-file).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { BannerProvider, useBannerState } from '@/hooks/useBannerState'
import type { ParsedProduct, BannerState } from '@/types'

// ---------------------------------------------------------------------------
// Mock persistenceService
// ---------------------------------------------------------------------------

vi.mock('@/services/persistenceService', () => ({
  saveEditorState: vi.fn(() => Promise.resolve()),
  loadEditorState: vi.fn(() => Promise.resolve(undefined)),
  clearEditorState: vi.fn(() => Promise.resolve()),
  serializeBannerState: vi.fn(async (s: BannerState) => s),
  deserializeBannerState: vi.fn((s: BannerState) => s),
}))

import * as persistenceService from '@/services/persistenceService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    id: 'product-1',
    name: 'Test Product',
    shortDesc: 'A product',
    imageUrl: 'https://example.com/img.png',
    hasValidImage: true,
    isVeg: false,
    isRelated: false,
    parentId: null,
    quantitySticker: null,
    provider: {
      brandName: 'Test Brand',
      brandLogo: 'https://example.com/logo.png',
      companyName: 'Test Co',
    },
    ...overrides,
  }
}

function makeSavedState(overrides: Partial<BannerState> = {}): BannerState {
  return {
    selectedProduct: makeProduct(),
    selectedBackground: null,
    ctaText: 'BUY NOW',
    badgeText: 'Sale',
    showTnc: false,
    showBadge: true,
    showPrice: true,
    showLogo: true,
    showHeading: true,
    showCta: true,
    showSubheading: true,
    subheadingText: 'Saved subheading',
    tncText: '*T&C Apply',
    brandLogoOverride: null,
    productNameOverride: 'Saved name',
    priceOverride: null,
    productImageSources: [],
    activeProductImageSourceId: null,
    logoImageSources: [],
    activeLogoImageSourceId: null,
    logoScale: 1.5,
    productImageScale: 0.8,
    quantityStickerText: null,
    showQuantitySticker: false,
    showOriginalLogo: false,
    ...overrides,
  }
}

function renderBannerHook() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BannerProvider>{children}</BannerProvider>
  )
  return renderHook(() => useBannerState(), { wrapper })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(persistenceService.loadEditorState).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Auto-save (uses fake timers to control debounce)
// ---------------------------------------------------------------------------

describe('useBannerState — auto-save persistence wiring', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not call saveEditorState when no product is selected', async () => {
    renderBannerHook()
    vi.advanceTimersByTime(2000)
    expect(persistenceService.saveEditorState).not.toHaveBeenCalled()
  })

  it('calls saveEditorState (debounced) after a state field changes with a product selected', async () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })
    act(() => { result.current.setCtaText('ORDER NOW') })

    // Before the 800ms debounce fires, save should not have been called
    expect(persistenceService.saveEditorState).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(900) })

    expect(persistenceService.saveEditorState).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ ctaText: 'ORDER NOW' }),
    )
  })

  it('debounces: only one save fires after rapid consecutive changes', async () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })
    act(() => { result.current.setCtaText('A') })
    act(() => { result.current.setCtaText('AB') })
    act(() => { result.current.setCtaText('ABC') })

    await act(async () => { vi.advanceTimersByTime(900) })

    expect(persistenceService.saveEditorState).toHaveBeenCalledTimes(1)
    expect(persistenceService.saveEditorState).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({ ctaText: 'ABC' }),
    )
  })
})

// ---------------------------------------------------------------------------
// selectProduct — load from persistence (real timers so waitFor works)
// ---------------------------------------------------------------------------

describe('useBannerState — selectProduct persistence wiring', () => {
  it('calls loadEditorState with the product id when selectProduct runs', async () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })

    await waitFor(() => {
      expect(persistenceService.loadEditorState).toHaveBeenCalledWith('product-1')
    })
  })

  it('restores saved state when loadEditorState returns a record', async () => {
    const saved = makeSavedState({ ctaText: 'BUY NOW', logoScale: 1.5, productNameOverride: 'Saved name' })
    vi.mocked(persistenceService.loadEditorState).mockResolvedValueOnce(saved)

    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    await waitFor(() => expect(result.current.ctaText).toBe('BUY NOW'))
    expect(result.current.logoScale).toBe(1.5)
    expect(result.current.productNameOverride).toBe('Saved name')
  })

  it('uses default state when loadEditorState returns undefined', async () => {
    vi.mocked(persistenceService.loadEditorState).mockResolvedValueOnce(undefined)

    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    await waitFor(() => expect(persistenceService.loadEditorState).toHaveBeenCalled())

    expect(result.current.ctaText).toBe('SHOP NOW')
    expect(result.current.logoScale).toBe(1)
  })

  it('does not call loadEditorState when selecting null', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(null) })
    expect(persistenceService.loadEditorState).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// resetToDefault (real timers — no debounce interaction needed)
// ---------------------------------------------------------------------------

describe('useBannerState — resetToDefault persistence wiring', () => {
  it('calls clearEditorState with the current product id', async () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    act(() => { result.current.resetToDefault() })

    expect(persistenceService.clearEditorState).toHaveBeenCalledWith('product-1')
  })

  it('resets logoScale to 1 after resetToDefault', () => {
    const { result } = renderBannerHook()
    act(() => {
      result.current.selectProduct(makeProduct())
      result.current.setLogoScale(1.8)
    })
    expect(result.current.logoScale).toBe(1.8)

    act(() => { result.current.resetToDefault() })

    expect(result.current.logoScale).toBe(1)
  })

  it('resets productNameOverride to null after resetToDefault', () => {
    const { result } = renderBannerHook()
    act(() => {
      result.current.selectProduct(makeProduct())
      result.current.setProductNameOverride('Override')
    })
    expect(result.current.productNameOverride).toBe('Override')

    act(() => { result.current.resetToDefault() })

    expect(result.current.productNameOverride).toBeNull()
  })

  it('resets productImageScale to 1 after resetToDefault', () => {
    const { result } = renderBannerHook()
    act(() => {
      result.current.selectProduct(makeProduct())
      result.current.setProductImageScale(0.5)
    })
    expect(result.current.productImageScale).toBe(0.5)

    act(() => { result.current.resetToDefault() })

    expect(result.current.productImageScale).toBe(1)
  })

  it('does not throw when resetToDefault is called with no product selected', () => {
    const { result } = renderBannerHook()
    expect(() => {
      act(() => { result.current.resetToDefault() })
    }).not.toThrow()
    expect(persistenceService.clearEditorState).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ER-13: showOriginal / showOriginalLogo toggle actions
// ---------------------------------------------------------------------------

describe('useBannerState — showOriginal toggles (ER-13)', () => {
  it('addProductImageSource initialises showOriginal to false', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let newId: string = ''
    act(() => { newId = result.current.addProductImageSource('blob:test') })

    const src = result.current.productImageSources.find(s => s.id === newId)
    expect(src?.showOriginal).toBe(false)
  })

  it('toggleShowOriginal flips showOriginal on the correct source only', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let id1: string = ''
    let id2: string = ''
    act(() => {
      id1 = result.current.addProductImageSource('blob:a')
      id2 = result.current.addProductImageSource('blob:b')
    })

    act(() => { result.current.toggleShowOriginal(id1) })

    const s1 = result.current.productImageSources.find(s => s.id === id1)
    const s2 = result.current.productImageSources.find(s => s.id === id2)
    expect(s1?.showOriginal).toBe(true)
    expect(s2?.showOriginal).toBe(false)
  })

  it('toggleShowOriginal flips back: true → false → true', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let id: string = ''
    act(() => { id = result.current.addProductImageSource('blob:test') })

    act(() => { result.current.toggleShowOriginal(id) })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(true)

    act(() => { result.current.toggleShowOriginal(id) })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(false)

    act(() => { result.current.toggleShowOriginal(id) })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(true)
  })

  it('toggleShowOriginalLogo flips showOriginalLogo independently', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    expect(result.current.showOriginalLogo).toBe(false)
    act(() => { result.current.toggleShowOriginalLogo() })
    expect(result.current.showOriginalLogo).toBe(true)
    act(() => { result.current.toggleShowOriginalLogo() })
    expect(result.current.showOriginalLogo).toBe(false)
  })

  it('toggleShowOriginalLogo does not affect productImageSources', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let id: string = ''
    act(() => { id = result.current.addProductImageSource('blob:x') })
    act(() => { result.current.toggleShowOriginalLogo() })

    const src = result.current.productImageSources.find(s => s.id === id)
    expect(src?.showOriginal).toBe(false)
  })

  it('selectProduct resets all showOriginal to false and showOriginalLogo to false', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let id: string = ''
    act(() => { id = result.current.addProductImageSource('blob:x') })
    act(() => {
      result.current.toggleShowOriginal(id)
      result.current.toggleShowOriginalLogo()
    })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(true)
    expect(result.current.showOriginalLogo).toBe(true)

    // Re-select clears everything
    act(() => { result.current.selectProduct(makeProduct({ id: 'product-2', imageUrl: 'https://example.com/other.png' })) })
    expect(result.current.showOriginalLogo).toBe(false)
    // New catalogue source starts with showOriginal: false
    expect(result.current.productImageSources[0]?.showOriginal).toBe(false)
  })

  it('resetShowOriginal sets showOriginal to false on the targeted source', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })

    let id: string = ''
    act(() => { id = result.current.addProductImageSource('blob:x') })
    act(() => { result.current.toggleShowOriginal(id) })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(true)

    act(() => { result.current.resetShowOriginal(id) })
    expect(result.current.productImageSources.find(s => s.id === id)?.showOriginal).toBe(false)
  })
})
