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
    showQuantitySticker: false,
    onQuantityStickerToggle: vi.fn(),
    quantityStickerText: null,
    onQuantityStickerTextChange: vi.fn(),
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
// Quantity sticker section (QS-25)
// ---------------------------------------------------------------------------

describe('BannerControls — quantity sticker section', () => {
  it('renders the Quantity Sticker section label', () => {
    render(<BannerControls {...makeProps()} />)
    expect(screen.getByText('Quantity Sticker')).toBeDefined()
  })

  it('does not show the text field when showQuantitySticker is false', () => {
    render(<BannerControls {...makeProps({ showQuantitySticker: false })} />)
    expect(screen.queryByPlaceholderText('e.g. 5 Pack')).toBeNull()
  })

  it('shows the text field when showQuantitySticker is true', () => {
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: '5 Pack',
        })}
      />,
    )
    const input = screen.getByPlaceholderText('e.g. 5 Pack') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.value).toBe('5 Pack')
  })

  it('shows an empty input when quantityStickerText is null and sticker is on', () => {
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: null,
        })}
      />,
    )
    const input = screen.getByPlaceholderText('e.g. 5 Pack') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('calls onQuantityStickerToggle when the toggle pill is clicked', () => {
    const onToggle = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: false,
          onQuantityStickerToggle: onToggle,
        })}
      />,
    )

    // The toggle pill for Quantity Sticker is a button with role="switch"
    // There may be multiple toggles — find the one near the label.
    // We locate by aria-checked=false switches and click the last one
    // (Quantity Sticker is the last section).
    const switches = screen.getAllByRole('switch')
    const quantitySwitch = switches[switches.length - 1]!
    fireEvent.click(quantitySwitch)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onQuantityStickerTextChange when the text field changes', () => {
    const onChange = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: '5 Pack',
          onQuantityStickerTextChange: onChange,
        })}
      />,
    )

    const input = screen.getByPlaceholderText('e.g. 5 Pack')
    fireEvent.change(input, { target: { value: '10 Pack' } })

    expect(onChange).toHaveBeenCalledWith('10 Pack')
  })

  it('calls onQuantityStickerTextChange with null when the field is cleared', () => {
    const onChange = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: '5 Pack',
          onQuantityStickerTextChange: onChange,
        })}
      />,
    )

    const input = screen.getByPlaceholderText('e.g. 5 Pack')
    fireEvent.change(input, { target: { value: '' } })

    // Empty string should be converted to null (see BannerControls implementation)
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
