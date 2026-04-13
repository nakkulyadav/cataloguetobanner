import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import BannerControls from '@/components/BannerControls/BannerControls'
import type { ImageSource } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSource(overrides: Partial<ImageSource> = {}): ImageSource {
  return {
    id: 'catalogue',
    label: 'Catalogue',
    originalUrl: 'https://example.com/product.png',
    bgRemovedUrl: null,
    bgRemovalStatus: 'idle',
    showBgRemoved: false,
    source: 'catalogue',
    ...overrides,
  }
}

/**
 * Minimal props to render BannerControls without errors.
 */
function makeProps(overrides: Partial<React.ComponentProps<typeof BannerControls>> = {}) {
  return {
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: false,
    showBadge: false,
    tncText: '*T&C Apply',
    backgrounds: [],
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
    productImageScale: 1,
    onProductImageScaleChange: vi.fn(),
    // ISL props
    productImageSources: [],
    activeProductImageSourceId: null,
    onAddProductImage: vi.fn(),
    onRemoveProductImageSource: vi.fn(),
    onSelectProductImageSource: vi.fn(),
    onToggleSourceBgRemoved: vi.fn(),
    hasBgRemovedLogo: false,
    showBgRemovedLogo: false,
    onToggleBgRemovedLogo: vi.fn(),
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
    expect(sliders.length).toBeGreaterThanOrEqual(1)
  })

  it('always renders the product image zoom slider', () => {
    render(<BannerControls {...makeProps()} />)
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
// ISL-9c — ImageSourceList integration
// ---------------------------------------------------------------------------

describe('BannerControls — ImageSourceList (ISL-9c)', () => {
  it('renders ImageSourceList thumbnails when productImageSources is non-empty', () => {
    const sources = [makeSource()]
    render(<BannerControls {...makeProps({ productImageSources: sources, activeProductImageSourceId: 'catalogue' })} />)
    // Thumbnail chip rendered as a button with aria-label = source label
    expect(screen.getByRole('button', { name: 'Catalogue' })).toBeInTheDocument()
  })

  it('does not render source thumbnails when productImageSources is empty', () => {
    render(<BannerControls {...makeProps({ productImageSources: [] })} />)
    expect(screen.queryByRole('button', { name: 'Catalogue' })).toBeNull()
  })

  it('calls onSelectProductImageSource when a thumbnail is clicked', () => {
    const onSelect = vi.fn()
    const sources = [makeSource(), makeSource({ id: 'user-1', label: 'Upload 1', source: 'user' })]
    render(
      <BannerControls
        {...makeProps({
          productImageSources: sources,
          activeProductImageSourceId: 'user-1',
          onSelectProductImageSource: onSelect,
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Catalogue' }))
    expect(onSelect).toHaveBeenCalledWith('catalogue')
  })

  it('shows remove button on user sources but not on catalogue source', () => {
    const sources = [
      makeSource({ id: 'catalogue', label: 'Catalogue', source: 'catalogue' }),
      makeSource({ id: 'user-1', label: 'Upload 1', source: 'user' }),
    ]
    render(
      <BannerControls
        {...makeProps({
          productImageSources: sources,
          activeProductImageSourceId: 'catalogue',
        })}
      />,
    )
    // Remove button exists for user source
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeInTheDocument()
    // Only one remove button (not for catalogue)
    expect(screen.getAllByRole('button', { name: 'Remove image' })).toHaveLength(1)
  })

  it('calls onRemoveProductImageSource when remove button is clicked', () => {
    const onRemove = vi.fn()
    const sources = [
      makeSource({ id: 'catalogue', label: 'Catalogue', source: 'catalogue' }),
      makeSource({ id: 'user-1', label: 'Upload 1', source: 'user' }),
    ]
    render(
      <BannerControls
        {...makeProps({
          productImageSources: sources,
          activeProductImageSourceId: 'user-1',
          onRemoveProductImageSource: onRemove,
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(onRemove).toHaveBeenCalledWith('user-1')
  })

  it('shows BgVersionPill when active source bgRemovalStatus is done', () => {
    const sources = [
      makeSource({ bgRemovalStatus: 'done', bgRemovedUrl: 'blob:bg', showBgRemoved: true }),
    ]
    render(
      <BannerControls
        {...makeProps({
          productImageSources: sources,
          activeProductImageSourceId: 'catalogue',
        })}
      />,
    )
    // BgVersionPill renders "BG Removed" text
    expect(screen.getByText('BG Removed')).toBeInTheDocument()
  })

  it('does not show BgVersionPill when active source bgRemovalStatus is not done', () => {
    const sources = [makeSource({ bgRemovalStatus: 'idle' })]
    render(
      <BannerControls
        {...makeProps({
          productImageSources: sources,
          activeProductImageSourceId: 'catalogue',
        })}
      />,
    )
    // BgVersionPill shows "BG Removed" text; absent here since status is not done
    expect(screen.queryByText('BG Removed')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Logo bg-version toggle (unchanged from before)
// ---------------------------------------------------------------------------

describe('BannerControls — logo bg-removed toggle', () => {
  it('renders the logo version toggle when hasBgRemovedLogo is true and showLogo is true', () => {
    render(
      <BannerControls
        {...makeProps({ showLogo: true, hasBgRemovedLogo: true, showBgRemovedLogo: true })}
      />,
    )
    expect(screen.getByText('BG Removed')).toBeInTheDocument()
  })

  it('does not render the logo version toggle when hasBgRemovedLogo is false', () => {
    render(<BannerControls {...makeProps({ showLogo: true, hasBgRemovedLogo: false })} />)
    expect(screen.queryByText('BG Removed')).toBeNull()
  })

  it('calls onToggleBgRemovedLogo when the logo toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showLogo: true,
          hasBgRemovedLogo: true,
          showBgRemovedLogo: false,
          onToggleBgRemovedLogo: onToggle,
        })}
      />,
    )
    fireEvent.click(screen.getByText('Original'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// QST-13: Quantity Sticker section
// ---------------------------------------------------------------------------

describe('BannerControls — Quantity Sticker (QST-13)', () => {
  it('renders the Quantity Sticker section header', () => {
    render(<BannerControls {...makeProps()} />)
    expect(screen.getByText(/quantity sticker/i)).toBeInTheDocument()
  })

  it('does not render the text input when showQuantitySticker is false', () => {
    render(<BannerControls {...makeProps({ showQuantitySticker: false })} />)
    expect(screen.queryByPlaceholderText(/pack of/i)).toBeNull()
  })

  it('renders the text input when showQuantitySticker is true', () => {
    render(
      <BannerControls
        {...makeProps({ showQuantitySticker: true, quantityStickerText: 'PACK OF 5' })}
      />,
    )
    expect(screen.getByDisplayValue('PACK OF 5')).toBeInTheDocument()
  })

  it('shows empty input when showQuantitySticker is true but quantityStickerText is null', () => {
    render(
      <BannerControls
        {...makeProps({ showQuantitySticker: true, quantityStickerText: null })}
      />,
    )
    expect(screen.getByPlaceholderText(/pack of/i)).toBeInTheDocument()
  })

  it('calls onQuantityStickerToggle when the toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <BannerControls {...makeProps({ onQuantityStickerToggle: onToggle })} />,
    )
    // The Quantity Sticker section has its own TogglePill — click the "Off" segment
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[switches.length - 1]!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onQuantityStickerTextChange with the new value when input changes', () => {
    const onChange = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: 'PACK OF 5',
          onQuantityStickerTextChange: onChange,
        })}
      />,
    )
    fireEvent.change(screen.getByDisplayValue('PACK OF 5'), { target: { value: 'PACK OF 10' } })
    expect(onChange).toHaveBeenCalledWith('PACK OF 10')
  })

  it('calls onQuantityStickerTextChange with null when input is cleared', () => {
    const onChange = vi.fn()
    render(
      <BannerControls
        {...makeProps({
          showQuantitySticker: true,
          quantityStickerText: 'PACK OF 5',
          onQuantityStickerTextChange: onChange,
        })}
      />,
    )
    fireEvent.change(screen.getByDisplayValue('PACK OF 5'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
