import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScheduledBannerCard from '@/components/DateSchedule/ScheduledBannerCard'
import type { ScheduledBannerEntry, BannerState } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ScheduledBannerEntry> = {}): ScheduledBannerEntry {
  return {
    id: 'entry-1',
    sheetRow: {
      date: '05/14/2026',
      offer: 'Free delivery',
      productUrl: 'https://digihaat.in/product/1',
      price: '₹99',
      heading: 'Test Product',
      subheading: '',
    },
    status: 'ready',
    bannerState: makeBannerState(),
    error: null,
    bgRemovalStatus: 'idle',
    bgRemovalError: null,
    bgRemovedLogoUrl: null,
    showBgRemovedLogo: false,
    aiGenStatus: 'idle',
    aiGenError: null,
    enhanceStatus: 'idle',
    enhanceStep: '',
    ...overrides,
  }
}

function makeBannerState(overrides: Partial<BannerState> = {}): BannerState {
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

// ---------------------------------------------------------------------------
// ER-15: Enhance button in scheduled mode
// ---------------------------------------------------------------------------

describe('ScheduledBannerCard — Enhance button (ER-15)', () => {
  it('no onEnhance prop: Enhance button is not rendered', () => {
    render(<ScheduledBannerCard entry={makeEntry()} />)
    expect(screen.queryByRole('button', { name: /enhance/i })).not.toBeInTheDocument()
  })

  it('idle: Enhance button is visible and enabled', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="idle"
      />,
    )
    const btn = screen.getByRole('button', { name: 'Enhance' })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it('idle: clicking Enhance calls onEnhance', () => {
    const onEnhance = vi.fn()
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={onEnhance}
        enhanceJobStatus="idle"
      />,
    )
    screen.getByRole('button', { name: 'Enhance' }).click()
    expect(onEnhance).toHaveBeenCalledTimes(1)
  })

  it('running: button is disabled and shows step text', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="running"
        enhanceJobStep="Enhancing product image..."
      />,
    )
    const btn = screen.getByRole('button', { name: 'Enhancing product image...' })
    expect(btn).toBeDisabled()
  })

  it('running: overlay is rendered over the banner', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="running"
        enhanceJobStep="Removing background..."
      />,
    )
    expect(screen.getByLabelText('Enhancing…')).toBeInTheDocument()
  })

  it('done: Enhance button is absent from the DOM', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="done"
      />,
    )
    expect(screen.queryByRole('button', { name: /enhance/i })).not.toBeInTheDocument()
  })

  it('error: "Retry Enhance" button is visible and enabled', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="error"
      />,
    )
    const btn = screen.getByRole('button', { name: 'Retry Enhance' })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it('error: error note is displayed below the button', () => {
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        onEnhance={vi.fn()}
        enhanceJobStatus="error"
      />,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
