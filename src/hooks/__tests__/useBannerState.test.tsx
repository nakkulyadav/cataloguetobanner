import { describe, it, expect, vi, beforeAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { BannerProvider, useBannerState } from '@/hooks/useBannerState'
import type { ParsedProduct, BannerState, ImageSource } from '@/types'

// jsdom does not implement URL.revokeObjectURL — stub it so tests that revoke
// blob URLs (e.g. removeProductImageSource) don't throw.
beforeAll(() => {
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    id: 'item-1',
    name: 'Test Product',
    shortDesc: 'A test product',
    imageUrl: 'https://example.com/product.png',
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

function renderBannerHook() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BannerProvider>{children}</BannerProvider>
  )
  return renderHook(() => useBannerState(), { wrapper })
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('useBannerState — initial state', () => {
  it('initialises logoScale to 1', () => {
    const { result } = renderBannerHook()
    expect(result.current.logoScale).toBe(1)
  })

  it('initialises productImageScale to 1', () => {
    const { result } = renderBannerHook()
    expect(result.current.productImageScale).toBe(1)
  })

  it('initialises productImageSources to empty array', () => {
    const { result } = renderBannerHook()
    expect(result.current.productImageSources).toEqual([])
  })

  it('initialises activeProductImageSourceId to null', () => {
    const { result } = renderBannerHook()
    expect(result.current.activeProductImageSourceId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectProduct
// ---------------------------------------------------------------------------

describe('useBannerState — selectProduct', () => {
  it('resets logoScale to 1 when a new product is selected', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.setLogoScale(1.8) })
    expect(result.current.logoScale).toBe(1.8)

    act(() => { result.current.selectProduct(makeProduct()) })
    expect(result.current.logoScale).toBe(1)
  })

  it('resets productImageScale to 1 when a new product is selected', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.setProductImageScale(0.6) })
    expect(result.current.productImageScale).toBe(0.6)

    act(() => { result.current.selectProduct(makeProduct()) })
    expect(result.current.productImageScale).toBe(1)
  })

  it('creates a catalogue source when product has imageUrl', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })

    expect(result.current.productImageSources).toHaveLength(1)
    const src = result.current.productImageSources[0]!
    expect(src.id).toBe('catalogue')
    expect(src.source).toBe('catalogue')
    expect(src.originalUrl).toBe('https://example.com/product.png')
    expect(src.bgRemovalStatus).toBe('idle')
    expect(src.showBgRemoved).toBe(false)
    expect(result.current.activeProductImageSourceId).toBe('catalogue')
  })

  it('leaves sources empty when product has no imageUrl', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct({ imageUrl: undefined, hasValidImage: false })) })

    expect(result.current.productImageSources).toEqual([])
    expect(result.current.activeProductImageSourceId).toBeNull()
  })

  it('clears user sources when selecting a new product', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })
    act(() => { result.current.addProductImageSource('blob:user-1') })
    expect(result.current.productImageSources).toHaveLength(2)

    // Select a different product — user sources should be gone
    act(() => { result.current.selectProduct(makeProduct({ id: 'item-2', imageUrl: 'https://example.com/img2.png' })) })
    expect(result.current.productImageSources).toHaveLength(1)
    expect(result.current.productImageSources[0]!.id).toBe('catalogue')
  })

  it('selectProduct(null) clears sources and active id', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })
    act(() => { result.current.selectProduct(null) })

    expect(result.current.productImageSources).toEqual([])
    expect(result.current.activeProductImageSourceId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// addProductImageSource
// ---------------------------------------------------------------------------

describe('useBannerState — addProductImageSource', () => {
  it('appends a user source and sets it as active', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.selectProduct(makeProduct()) })

    let newId = ''
    act(() => { newId = result.current.addProductImageSource('blob:upload-1') })

    expect(result.current.productImageSources).toHaveLength(2)
    const added = result.current.productImageSources.find(s => s.id === newId)!
    expect(added.source).toBe('user')
    expect(added.originalUrl).toBe('blob:upload-1')
    expect(added.bgRemovalStatus).toBe('idle')
    expect(result.current.activeProductImageSourceId).toBe(newId)
  })

  it('uses custom label when provided', () => {
    const { result } = renderBannerHook()
    let newId = ''
    act(() => { newId = result.current.addProductImageSource('blob:x', 'Paste 1') })
    const src = result.current.productImageSources.find(s => s.id === newId)!
    expect(src.label).toBe('Paste 1')
  })

  it('auto-names uploads sequentially', () => {
    const { result } = renderBannerHook()
    let id1 = '', id2 = ''
    act(() => {
      id1 = result.current.addProductImageSource('blob:a')
      id2 = result.current.addProductImageSource('blob:b')
    })
    const s1 = result.current.productImageSources.find(s => s.id === id1)!
    const s2 = result.current.productImageSources.find(s => s.id === id2)!
    expect(s1.label).toBe('Upload 1')
    expect(s2.label).toBe('Upload 2')
  })
})

// ---------------------------------------------------------------------------
// removeProductImageSource
// ---------------------------------------------------------------------------

describe('useBannerState — removeProductImageSource', () => {
  it('removes a user source', () => {
    const { result } = renderBannerHook()
    let newId = ''
    act(() => {
      result.current.selectProduct(makeProduct())
      newId = result.current.addProductImageSource('blob:u1')
    })
    act(() => { result.current.removeProductImageSource(newId) })
    expect(result.current.productImageSources.find(s => s.id === newId)).toBeUndefined()
  })

  it('switches active to the preceding source when active source is removed', () => {
    const { result } = renderBannerHook()
    let id1 = '', id2 = ''
    act(() => {
      result.current.selectProduct(makeProduct())
      id1 = result.current.addProductImageSource('blob:u1')
      id2 = result.current.addProductImageSource('blob:u2')
    })
    expect(result.current.activeProductImageSourceId).toBe(id2)

    act(() => { result.current.removeProductImageSource(id2) })
    expect(result.current.activeProductImageSourceId).toBe(id1)
  })

  it('does nothing when trying to remove the catalogue source', () => {
    const { result } = renderBannerHook()
    act(() => { result.current.selectProduct(makeProduct()) })
    const before = result.current.productImageSources.length
    act(() => { result.current.removeProductImageSource('catalogue') })
    expect(result.current.productImageSources).toHaveLength(before)
  })
})

// ---------------------------------------------------------------------------
// updateProductImageSourceBg
// ---------------------------------------------------------------------------

describe('useBannerState — updateProductImageSourceBg', () => {
  it('patches bg state on the targeted source only', () => {
    const { result } = renderBannerHook()
    let userId = ''
    act(() => {
      result.current.selectProduct(makeProduct())
      userId = result.current.addProductImageSource('blob:u1')
    })

    act(() => {
      result.current.updateProductImageSourceBg('catalogue', {
        bgRemovedUrl: 'blob:cat-bg',
        bgRemovalStatus: 'done',
        showBgRemoved: true,
      })
    })

    const catSrc = result.current.productImageSources.find(s => s.id === 'catalogue')!
    const userSrc = result.current.productImageSources.find(s => s.id === userId)!
    expect(catSrc.bgRemovedUrl).toBe('blob:cat-bg')
    expect(catSrc.bgRemovalStatus).toBe('done')
    expect(catSrc.showBgRemoved).toBe(true)
    // user source is unchanged
    expect(userSrc.bgRemovalStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// toggleSourceBgRemoved
// ---------------------------------------------------------------------------

describe('useBannerState — toggleSourceBgRemoved', () => {
  it('flips showBgRemoved on the targeted source only', () => {
    const { result } = renderBannerHook()
    let userId = ''
    act(() => {
      result.current.selectProduct(makeProduct())
      userId = result.current.addProductImageSource('blob:u1')
    })

    act(() => { result.current.toggleSourceBgRemoved('catalogue') })

    const catSrc = result.current.productImageSources.find(s => s.id === 'catalogue')!
    const userSrc = result.current.productImageSources.find(s => s.id === userId)!
    expect(catSrc.showBgRemoved).toBe(true)
    expect(userSrc.showBgRemoved).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

describe('useBannerState — loadState', () => {
  it('restores productImageSources and activeProductImageSourceId from state', () => {
    const { result } = renderBannerHook()

    const sources: ImageSource[] = [
      {
        id: 'catalogue',
        label: 'Catalogue',
        originalUrl: 'https://example.com/img.png',
        bgRemovedUrl: 'blob:bg',
        bgRemovalStatus: 'done',
        showBgRemoved: true,
        source: 'catalogue',
      },
    ]

    const state: BannerState = {
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
      showSubheading: false,
      subheadingText: '',
      tncText: '*T&C Apply',
      brandLogoOverride: null,
      productNameOverride: null,
      priceOverride: null,
      productImageSources: sources,
      activeProductImageSourceId: 'catalogue',
      logoImageSources: [],
      activeLogoImageSourceId: null,
      logoScale: 1.2,
      productImageScale: 0.8,
      quantityStickerText: null,
      showQuantitySticker: false,
    }

    act(() => { result.current.loadState(state) })

    expect(result.current.productImageSources).toEqual(sources)
    expect(result.current.activeProductImageSourceId).toBe('catalogue')
    expect(result.current.logoScale).toBe(1.2)
    expect(result.current.productImageScale).toBe(0.8)
  })
})
