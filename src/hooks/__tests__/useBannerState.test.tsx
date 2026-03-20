import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { BannerProvider, useBannerState } from '@/hooks/useBannerState'
import type { ParsedProduct } from '@/types'

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
    provider: {
      brandName: 'Test Brand',
      brandLogo: 'https://example.com/logo.png',
      companyName: 'Test Co',
    },
    ...overrides,
  }
}

/**
 * Renders useBannerState inside BannerProvider so the context is available.
 */
function renderBannerHook() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BannerProvider>{children}</BannerProvider>
  )
  return renderHook(() => useBannerState(), { wrapper })
}

// ---------------------------------------------------------------------------
// Quantity sticker — initial state (QS-11)
// ---------------------------------------------------------------------------

describe('useBannerState — initial state', () => {
  it('initialises showQuantitySticker as false', () => {
    const { result } = renderBannerHook()
    expect(result.current.showQuantitySticker).toBe(false)
  })

  it('initialises quantityStickerText as null', () => {
    const { result } = renderBannerHook()
    expect(result.current.quantityStickerText).toBeNull()
  })

  it('initialises logoScale to 1', () => {
    const { result } = renderBannerHook()
    expect(result.current.logoScale).toBe(1)
  })

  it('initialises productImageScale to 1', () => {
    const { result } = renderBannerHook()
    expect(result.current.productImageScale).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// selectProduct — auto-populate quantity sticker (QS-21)
// ---------------------------------------------------------------------------

describe('useBannerState — selectProduct with quantity', () => {
  it('auto-populates quantityStickerText when product has quantity data', () => {
    const { result } = renderBannerHook()
    const product = makeProduct({
      quantity: { unit: 'Pack', value: '5' },
    })

    act(() => { result.current.selectProduct(product) })

    expect(result.current.quantityStickerText).toBe('Pack of 5')
  })

  it('formats volume quantities correctly', () => {
    const { result } = renderBannerHook()
    const product = makeProduct({
      quantity: { unit: 'ml', value: '200' },
    })

    act(() => { result.current.selectProduct(product) })

    expect(result.current.quantityStickerText).toBe('200 ml')
  })
})

// ---------------------------------------------------------------------------
// selectProduct — no quantity data (QS-22)
// ---------------------------------------------------------------------------

describe('useBannerState — selectProduct without quantity', () => {
  it('sets quantityStickerText to null when product has no quantity field', () => {
    const { result } = renderBannerHook()

    // First select a product that has quantity, to ensure the reset works
    act(() => {
      result.current.selectProduct(makeProduct({ quantity: { unit: 'Pack', value: '3' } }))
    })
    expect(result.current.quantityStickerText).toBe('Pack of 3')

    // Now select one without quantity — should clear back to null
    act(() => { result.current.selectProduct(makeProduct()) })

    expect(result.current.quantityStickerText).toBeNull()
  })

  it('does not change showQuantitySticker when selecting a product', () => {
    const { result } = renderBannerHook()

    // Enable the sticker first
    act(() => { result.current.toggleQuantitySticker() })
    expect(result.current.showQuantitySticker).toBe(true)

    // Selecting a product (even one without quantity) must not auto-disable the toggle
    act(() => { result.current.selectProduct(makeProduct()) })

    expect(result.current.showQuantitySticker).toBe(true)
  })

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

  it('sets quantityStickerText to null when null product is selected', () => {
    const { result } = renderBannerHook()

    act(() => {
      result.current.selectProduct(makeProduct({ quantity: { unit: 'g', value: '100' } }))
    })
    act(() => { result.current.selectProduct(null) })

    expect(result.current.quantityStickerText).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// toggleQuantitySticker (QS-13)
// ---------------------------------------------------------------------------

describe('useBannerState — toggleQuantitySticker', () => {
  it('toggles showQuantitySticker from false to true', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.toggleQuantitySticker() })

    expect(result.current.showQuantitySticker).toBe(true)
  })

  it('toggles showQuantitySticker back to false on second call', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.toggleQuantitySticker() })
    act(() => { result.current.toggleQuantitySticker() })

    expect(result.current.showQuantitySticker).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setQuantityStickerText (QS-13)
// ---------------------------------------------------------------------------

describe('useBannerState — setQuantityStickerText', () => {
  it('updates quantityStickerText to a new string', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.setQuantityStickerText('10 Pack') })

    expect(result.current.quantityStickerText).toBe('10 Pack')
  })

  it('allows clearing quantityStickerText to null', () => {
    const { result } = renderBannerHook()

    act(() => { result.current.setQuantityStickerText('5 Pack') })
    act(() => { result.current.setQuantityStickerText(null) })

    expect(result.current.quantityStickerText).toBeNull()
  })
})
