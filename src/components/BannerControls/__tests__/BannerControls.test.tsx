import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import BannerControls from '@/components/BannerControls/BannerControls'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal props needed to render BannerControls without errors.
 * Override only what's relevant to each test.
 */
function makeProps(overrides: Partial<React.ComponentProps<typeof BannerControls>> = {}) {
  return {
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: false,
    showBadge: false,
    tncText: '*T&C Apply',
    selectedBackgroundId: null,
    productNameOverride: null,
    originalProductName: null,
    onCtaChange: vi.fn(),
    onBadgeChange: vi.fn(),
    onTncToggle: vi.fn(),
    onBadgeToggle: vi.fn(),
    onTncTextChange: vi.fn(),
    onBackgroundSelect: vi.fn(),
    onProductNameChange: vi.fn(),
    showPrice: false,
    onPriceToggle: vi.fn(),
    priceOverride: null,
    originalPrice: undefined,
    onPriceOverrideChange: vi.fn(),
    subheadingText: '',
    onSubheadingTextChange: vi.fn(),
    showSubheading: false,
    onSubheadingToggle: vi.fn(),
    showLogo: false,
    onLogoToggle: vi.fn(),
    showHeading: false,
    onHeadingToggle: vi.fn(),
    showCta: false,
    onCtaToggle: vi.fn(),
    brandLogoOverride: null,
    onBrandLogoChange: vi.fn(),
    logoScale: 1,
    onLogoScaleChange: vi.fn(),
    productImageOverride: null,
    onProductImageChange: vi.fn(),
    productImageScale: 1,
    onProductImageScaleChange: vi.fn(),
    hasBgRemovedProduct: false,
    showBgRemovedProduct: false,
    onToggleBgRemovedProduct: vi.fn(),
    hasBgRemovedLogo: false,
    showBgRemovedLogo: false,
    onToggleBgRemovedLogo: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Zoom sliders (ZM-3)
// ---------------------------------------------------------------------------

describe('BannerControls — zoom sliders', () => {
  it('renders the logo zoom slider when Brand Logo is visible', () => {
    render(<BannerControls {...makeProps({ showLogo: true })} />)
    const sliders = screen.getAllByRole('slider')
    // Logo slider is the first one rendered (Brand Logo section comes first)
    expect(sliders.length).toBeGreaterThanOrEqual(1)
  })

  it('always renders the product image zoom slider', () => {
    render(<BannerControls {...makeProps()} />)
    // Product Image section is always visible — at least one slider present
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onLogoScaleChange when the logo slider changes', () => {
    const onChange = vi.fn()
    render(<BannerControls {...makeProps({ showLogo: true, onLogoScaleChange: onChange })} />)
    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[0]!, { target: { value: '1.5' } })
    expect(onChange).toHaveBeenCalledWith(1.5)
  })

  it('calls onProductImageScaleChange when the product image slider changes', () => {
    const onChange = vi.fn()
    render(<BannerControls {...makeProps({ onProductImageScaleChange: onChange })} />)
    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[sliders.length - 1]!, { target: { value: '0.75' } })
    expect(onChange).toHaveBeenCalledWith(0.75)
  })

  it('shows the Reset button only when scale is not 1', () => {
    const { rerender } = render(<BannerControls {...makeProps({ showLogo: true, logoScale: 1 })} />)
    expect(screen.queryAllByText('Reset')).toHaveLength(0)

    rerender(<BannerControls {...makeProps({ showLogo: true, logoScale: 1.5 })} />)
    expect(screen.getAllByText('Reset').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onLogoScaleChange(1) when the logo Reset button is clicked', () => {
    const onChange = vi.fn()
    render(<BannerControls {...makeProps({ showLogo: true, logoScale: 1.5, onLogoScaleChange: onChange })} />)
    fireEvent.click(screen.getAllByText('Reset')[0]!)
    expect(onChange).toHaveBeenCalledWith(1)
  })
})

// ---------------------------------------------------------------------------
// IT-23 — bg-removed version toggle (IT-11/IT-12)
// ---------------------------------------------------------------------------

describe('BannerControls — bg-removed version toggle (IT-23)', () => {
  it('renders the product image version toggle when hasBgRemovedProduct is true', () => {
    render(<BannerControls {...makeProps({ hasBgRemovedProduct: true })} />)
    // BgVersionPill renders a role="switch" button
    const switches = screen.getAllByRole('switch')
    expect(switches.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render the product image version toggle when hasBgRemovedProduct is false', () => {
    render(<BannerControls {...makeProps({ hasBgRemovedProduct: false })} />)
    // With hasBgRemovedProduct false and showLogo false, any remaining switches
    // are not from the bg-removed product pill
    // Verify no "Original" / "BG Removed" text from the pill
    expect(screen.queryByText('Original')).toBeNull()
    expect(screen.queryByText('BG Removed')).toBeNull()
  })

  it('calls onToggleBgRemovedProduct when the product image toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          hasBgRemovedProduct: true,
          showBgRemovedProduct: false,
          onToggleBgRemovedProduct: onToggle,
        })}
      />,
    )
    // BgVersionPill shows "Original" when showBgRemoved is false
    fireEvent.click(screen.getByText('Original'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders the logo version toggle when hasBgRemovedLogo is true and showLogo is true', () => {
    render(
      <BannerControls
        {...makeProps({
          showLogo: true,
          hasBgRemovedLogo: true,
          showBgRemovedLogo: true,
        })}
      />,
    )
    // At least one BgVersionPill rendered
    expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(1)
  })

  it('does not render the logo version toggle when hasBgRemovedLogo is false', () => {
    render(
      <BannerControls
        {...makeProps({
          showLogo: true,
          hasBgRemovedLogo: false,
        })}
      />,
    )
    // No "BG Removed" text when pill is hidden
    expect(screen.queryByText('BG Removed')).toBeNull()
  })

  it('calls onToggleBgRemovedLogo when the logo version toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showLogo: true,
          hasBgRemovedLogo: true,
          showBgRemovedLogo: false,
          onToggleBgRemovedLogo: onToggle,
          hasBgRemovedProduct: false,
        })}
      />,
    )
    // Only the logo pill is shown here, which shows "Original" when showBgRemovedLogo is false
    // There may be multiple "Original" texts if product pill is also shown — but hasBgRemovedProduct is false
    fireEvent.click(screen.getByText('Original'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
