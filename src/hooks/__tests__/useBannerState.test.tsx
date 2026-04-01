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
})

// ---------------------------------------------------------------------------
// selectProduct (QS-22)
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

})
