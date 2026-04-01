import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BannerPreview from '@/components/BannerPreview/BannerPreview'
import {
  IMAGE_LEFT_BARRIER,
  PRODUCT_IMAGE,
  LOGO_MIN_TOP_PADDING,
  BRAND_LOGO,
  LEFT_SECTION_GAPS,
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
    logoScale: 1,
    productImageScale: 1,
    ...overrides,
  }
}

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

// ---------------------------------------------------------------------------
// Logo scale two-phase layout (LS-1, LS-2, LS-3)
//
// Phase 1: logo grows upward — non-logo elements stay anchored at their base
//   position (computed using BRAND_LOGO.height at scale=1).  Logo top decreases
//   toward LOGO_MIN_TOP_PADDING.
//
// Phase 2: logo top is clamped at LOGO_MIN_TOP_PADDING; elements below shift down.
//
// In jsdom scrollHeight is always 0, so heading height = 0 after the measurement
// effect.  Logo height = round(BRAND_LOGO.height × scale), testable without DOM.
//
// Phase boundary (logo + heading only, headingHeight=0 in jsdom):
//   usableHeight        = 312 - 10 - 10 = 292
//   baseGroupHeight     = 50 + 5 + 0   = 55
//   anchorGroupStart    = 10 + (292-55)/2 = 128.5
//   headingAnchorTop    = 128.5 + 50 + 5 = 183.5
//   phase 2 when logoScale > (178.5 - LOGO_MIN_TOP_PADDING) / 50 ≈ 3.47
//   → logoScale=4 (logo height=200) reliably triggers phase 2
// ---------------------------------------------------------------------------

describe('BannerPreview — logo scale two-phase layout (LS)', () => {
  function makeLogoState(logoScale: number): BannerState {
    return makeState({
      showLogo: true,
      brandLogoOverride: 'https://example.com/logo.png',
      showHeading: true,
      productNameOverride: 'Test Product',
      logoScale,
    })
  }

  /** Returns the visible heading div (excludes the hidden measurement div). */
  function getVisibleHeading(container: HTMLElement): HTMLElement {
    return Array.from(container.querySelectorAll<HTMLElement>('div'))
      .filter(el => el.textContent === 'Test Product' && el.getAttribute('aria-hidden') !== 'true')[0]!
  }

  /** Returns the logo img element by src. */
  function getLogoImg(container: HTMLElement): HTMLImageElement {
    return container.querySelector('img[src="https://example.com/logo.png"]') as HTMLImageElement
  }

  it('heading stays anchored during phase 1 — scale=1 and scale=2 produce the same heading top (LS-1)', () => {
    const { container: c1, unmount: u1 } = render(<BannerPreview state={makeLogoState(1)} />)
    const top1 = parseFloat(getVisibleHeading(c1).style.top)
    u1()

    const { container: c2 } = render(<BannerPreview state={makeLogoState(2)} />)
    const top2 = parseFloat(getVisibleHeading(c2).style.top)

    expect(top2).toBeCloseTo(top1, 0)
  })

  it('heading shifts down once logo hits LOGO_MIN_TOP_PADDING ceiling — scale=4 pushes heading lower than scale=1 (LS-1b)', () => {
    const { container: c1, unmount: u1 } = render(<BannerPreview state={makeLogoState(1)} />)
    const top1 = parseFloat(getVisibleHeading(c1).style.top)
    u1()

    const { container: c4 } = render(<BannerPreview state={makeLogoState(4)} />)
    const top4 = parseFloat(getVisibleHeading(c4).style.top)

    expect(top4).toBeGreaterThan(top1)
  })

  it('heading top = logo top + effective logo height + gap in both phases (LS-2)', () => {
    const logoGap = LEFT_SECTION_GAPS['logo-heading']!

    // Phase 1 (scale=1)
    const { container: c1, unmount: u1 } = render(<BannerPreview state={makeLogoState(1)} />)
    const logoTop1 = parseFloat(getLogoImg(c1).style.top)
    const headingTop1 = parseFloat(getVisibleHeading(c1).style.top)
    u1()

    // Phase 2 (scale=4)
    const { container: c4 } = render(<BannerPreview state={makeLogoState(4)} />)
    const logoTop4 = parseFloat(getLogoImg(c4).style.top)
    const headingTop4 = parseFloat(getVisibleHeading(c4).style.top)

    expect(headingTop1).toBeCloseTo(logoTop1 + Math.round(BRAND_LOGO.height * 1) + logoGap, 0)
    expect(headingTop4).toBeCloseTo(logoTop4 + Math.round(BRAND_LOGO.height * 4) + logoGap, 0)
  })

  it('logo top is clamped to LOGO_MIN_TOP_PADDING in phase 2 (LS-3)', () => {
    const { container } = render(<BannerPreview state={makeLogoState(4)} />)
    const logoTop = parseFloat(getLogoImg(container).style.top)
    expect(logoTop).toBe(LOGO_MIN_TOP_PADDING)
  })

  it('logo top decreases as scale increases during phase 1 (LS-4)', () => {
    const { container: c1, unmount: u1 } = render(<BannerPreview state={makeLogoState(1)} />)
    const logoTop1 = parseFloat(getLogoImg(c1).style.top)
    u1()

    const { container: c2 } = render(<BannerPreview state={makeLogoState(2)} />)
    const logoTop2 = parseFloat(getLogoImg(c2).style.top)

    expect(logoTop2).toBeLessThan(logoTop1)
  })
})

// ---------------------------------------------------------------------------
// Gap compression when content overflows (GC-1, GC-2)
//
// When all left-section elements are visible, the stack can exceed the usable
// canvas height.  The layout engine must compress inter-element gaps so that
// the first element still starts at >= LEFT_SECTION_TOP_PADDING.
// ---------------------------------------------------------------------------

describe('BannerPreview — layout gap compression (GC)', () => {
  function makeFullState(): BannerState {
    return makeState({
      showLogo: true,
      brandLogoOverride: 'https://example.com/logo.png',
      showHeading: true,
      productNameOverride: 'Product Name',
      showSubheading: true,
      subheadingText: 'Great tagline here',
      showPrice: true,
      priceOverride: { mrp: '₹499', sellingPrice: '₹199' },
      showCta: true,
      showTnc: true,
    })
  }

  it('renders without crashing with all left-section elements visible (GC-1)', () => {
    expect(() => render(<BannerPreview state={makeFullState()} />)).not.toThrow()
  })

  it('logo top is >= LOGO_MIN_TOP_PADDING even when all elements are visible (GC-2)', () => {
    const { container } = render(<BannerPreview state={makeFullState()} />)
    const logoEl = container.querySelector('img[src="https://example.com/logo.png"]') as HTMLImageElement
    const logoTop = parseFloat(logoEl.style.top)
    expect(logoTop).toBeGreaterThanOrEqual(LOGO_MIN_TOP_PADDING)
  })
})
