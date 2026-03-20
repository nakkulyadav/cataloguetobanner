import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import BannerPreview from '@/components/BannerPreview/BannerPreview'
import {
  IMAGE_LEFT_BARRIER,
  PRODUCT_IMAGE,
} from '@/constants/bannerTemplate'
import type { BannerState } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal BannerState with sensible defaults for testing.
 * Override only the fields relevant to each test.
 */
function makeState(overrides: Partial<BannerState> = {}): BannerState {
  return {
    selectedProduct: null,
    selectedBackground: null,
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: false,
    showBadge: false,
    showPrice: false,
    showLogo: false,
    showHeading: false,
    showCta: false,
    showSubheading: false,
    subheadingText: '',
    tncText: '*T&C Apply',
    brandLogoOverride: null,
    productNameOverride: null,
    priceOverride: null,
    productImageOverride: null,
    showQuantitySticker: false,
    quantityStickerText: null,
    logoScale: 1,
    productImageScale: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Quantity sticker rendering (QS-23, QS-24)
// ---------------------------------------------------------------------------

describe('BannerPreview — quantity sticker', () => {
  it('renders the sticker when showQuantitySticker is true and text is set (QS-23)', () => {
    render(
      <BannerPreview
        state={makeState({
          showQuantitySticker: true,
          quantityStickerText: '5 Pack',
        })}
      />,
    )

    expect(screen.getByText('5 Pack')).toBeDefined()
  })

  it('does not render the sticker when showQuantitySticker is false (QS-24)', () => {
    render(
      <BannerPreview
        state={makeState({
          showQuantitySticker: false,
          quantityStickerText: '5 Pack',
        })}
      />,
    )

    expect(screen.queryByText('5 Pack')).toBeNull()
  })

  it('does not render the sticker when quantityStickerText is null even if toggle is on', () => {
    render(
      <BannerPreview
        state={makeState({
          showQuantitySticker: true,
          quantityStickerText: null,
        })}
      />,
    )

    // No sticker element should be present — nothing to assert text on.
    // Verify the canvas renders without crashing (implicit by no thrown error).
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('does not render the sticker when quantityStickerText is null (falsy text suppressed)', () => {
    const { container } = render(
      <BannerPreview
        state={makeState({
          showQuantitySticker: true,
          quantityStickerText: null,
        })}
      />,
    )

    // Null text → sticker div absent entirely.
    // With no product/background/sticker, the banner contains only the
    // hidden measurement divs (aria-hidden="true") — one per adaptive element.
    const bannerDiv = container.firstChild as HTMLElement
    const visibleChildren = Array.from(bannerDiv.children).filter(
      el => el.getAttribute('aria-hidden') !== 'true',
    )
    expect(visibleChildren).toHaveLength(0)
  })

  it('renders correctly for a volume unit (e.g. 200 ml)', () => {
    render(
      <BannerPreview
        state={makeState({
          showQuantitySticker: true,
          quantityStickerText: '200 ml',
        })}
      />,
    )

    expect(screen.getByText('200 ml')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Product image left-edge clamping (IC-1, IC-2)
//
// The image is centred at `left` px with `translateX(-50%) scale(s)`, so its
// left edge lands at  left − (PRODUCT_IMAGE.width × s / 2).
// The invariant: that left edge must never cross IMAGE_LEFT_BARRIER.
//
// Clamping activates when  PRODUCT_IMAGE.centerX  <  barrier + halfWidth×s,
// i.e. at scale > (centerX − barrier) / halfWidth for the current constants.
// ---------------------------------------------------------------------------

describe('BannerPreview — product image left-edge clamping (IC)', () => {
  /** State with a visible product image at the given zoom scale. */
  function makeImageState(productImageScale: number): BannerState {
    return makeState({
      // productImageOverride drives hasValidImage = true without needing a
      // real ParsedProduct, keeping the test self-contained.
      productImageOverride: 'https://example.com/product.png',
      productImageScale,
    })
  }

  /** Returns the `left` pixel value from the product image's inline style. */
  function getProductImageLeft(container: HTMLElement): number {
    const img = container.querySelector('img[alt="Product"]') as HTMLImageElement
    return parseFloat(img.style.left)
  }

  /** Expected `left` for a given scale, mirroring the clamping formula. */
  function expectedLeft(scale: number): number {
    return Math.max(PRODUCT_IMAGE.centerX, IMAGE_LEFT_BARRIER + (PRODUCT_IMAGE.width * scale) / 2)
  }

  it('scale 1.0 — left equals nominal centerX (well below clamp threshold) (IC-2)', () => {
    // barrier + width/2 = 350 + 150 = 500 < 550 → no clamp.
    const { container } = render(<BannerPreview state={makeImageState(1.0)} />)
    expect(getProductImageLeft(container)).toBe(expectedLeft(1.0))
  })

  it('scale 1.5 — left is shifted right (clamp active) (IC-2)', () => {
    // barrier + width×1.5/2 = 350 + 225 = 575 > 550 → clamp kicks in.
    const { container } = render(<BannerPreview state={makeImageState(1.5)} />)
    expect(getProductImageLeft(container)).toBe(expectedLeft(1.5))
  })

  it('scale 2.0 — left is shifted further right (IC-2)', () => {
    // barrier + width×2.0/2 = 350 + 300 = 650 > 550.
    const { container } = render(<BannerPreview state={makeImageState(2.0)} />)
    expect(getProductImageLeft(container)).toBe(expectedLeft(2.0))
  })

  it('left edge never crosses IMAGE_LEFT_BARRIER for any scale in [1.0, 2.0] (IC-2)', () => {
    // Property test: sample representative scales and verify the invariant
    // left − (width × scale / 2) ≥ IMAGE_LEFT_BARRIER holds for all of them.
    const scales = [1.0, 1.1, 1.26, 1.3, 1.5, 1.75, 2.0]

    scales.forEach(scale => {
      const { container, unmount } = render(<BannerPreview state={makeImageState(scale)} />)
      const left = getProductImageLeft(container)
      const leftEdge = left - (PRODUCT_IMAGE.width * scale) / 2

      expect(leftEdge).toBeGreaterThanOrEqual(IMAGE_LEFT_BARRIER)
      unmount()
    })
  })
})
