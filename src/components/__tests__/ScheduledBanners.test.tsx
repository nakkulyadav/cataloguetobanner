import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScheduledBannersGrid from '@/components/DateSchedule/ScheduledBannersGrid'
import ScheduledBannerCard from '@/components/DateSchedule/ScheduledBannerCard'
import type { ScheduledBannerEntry, BannerState, ParsedProduct } from '@/types'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'

// ---------------------------------------------------------------------------
// Mock BannerPreview — prevents canvas/html-to-image from running in tests
// ---------------------------------------------------------------------------
vi.mock('@/components/BannerPreview/BannerPreview', () => ({
  default: vi.fn(({ state }: { state: import('@/types').BannerState | null }, _ref: unknown) => (
    <div
      data-testid="banner-preview"
      data-product-image-override={state?.productImageOverride ?? ''}
    />
  )),
}))

// Mock exportBanner — prevents DOM capture in tests
vi.mock('@/services/exportService', () => ({
  exportBanner: vi.fn().mockResolvedValue(undefined),
  generateFilename: vi.fn((name?: string) => `digihaat-${name ?? 'banner'}`),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    id: 'prod-1',
    name: 'Juicy Mangoes',
    shortDesc: 'Fresh mangoes',
    imageUrl: 'https://example.com/mango.jpg',
    hasValidImage: true,
    isVeg: true,
    isRelated: false,
    parentId: null,
    provider: { brandName: 'Test Brand', brandLogo: null, companyName: 'Test Co' },
    ...overrides,
  }
}

function makeBannerState(overrides: Partial<BannerState> = {}): BannerState {
  return {
    selectedProduct: makeProduct(),
    selectedBackground: BACKGROUND_OPTIONS[0] ?? null,
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: true,
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
    productImageOverride: null,
    logoScale: 1,
    productImageScale: 1,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<ScheduledBannerEntry> = {}): ScheduledBannerEntry {
  return {
    id: 'entry-1',
    sheetRow: {
      date: '3/30/2026',
      team: 'bazar page',
      page: 'Banner',
      offerCallout: 'Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?item_id=abc',
      comments: 'Header: Juicy Mangoes\nSubheader: Starting at ₹85',
    },
    status: 'ready',
    bannerState: makeBannerState(),
    error: null,
    bgRemovalStatus: 'idle',
    bgRemovalError: null,
    bgRemovedProductImageUrl: null,
    bgRemovedLogoUrl: null,
    showBgRemovedProduct: true,
    showBgRemovedLogo: true,
    ...overrides,
  }
}

// Default no-op props for ScheduledBannersGrid
const gridDefaults = {
  selectedDate: '',
  isFetching: false,
  fetchError: null,
  entries: [],
  editingId: null,
  onEditEntry: vi.fn(),
  editingBannerState: null,
  onRemoveBgEntry: vi.fn(),
  isRemovingBg: false,
}

// ---------------------------------------------------------------------------
// ScheduledBannersGrid tests
// ---------------------------------------------------------------------------

describe('ScheduledBannersGrid', () => {

  it('shows empty state when no date is selected', () => {
    render(<ScheduledBannersGrid {...gridDefaults} selectedDate="" />)
    expect(screen.getByText(/pick a date/i)).toBeInTheDocument()
  })

  it('shows loading spinner while isFetching is true', () => {
    render(
      <ScheduledBannersGrid
        {...gridDefaults}
        selectedDate="2026-03-30"
        isFetching={true}
      />
    )
    expect(screen.getByText(/loading promotions sheet/i)).toBeInTheDocument()
  })

  it('shows fetch error message when fetchError is set', () => {
    render(
      <ScheduledBannersGrid
        {...gridDefaults}
        selectedDate="2026-03-30"
        fetchError="No Bazaar banners scheduled for 3/30/2026"
      />
    )
    expect(screen.getByText(/No Bazaar banners/i)).toBeInTheDocument()
  })


  it('renders banner count when entries are present', () => {
    const entries = [makeEntry({ id: 'e-1' }), makeEntry({ id: 'e-2' })]
    render(
      <ScheduledBannersGrid
        {...gridDefaults}
        selectedDate="2026-03-30"
        entries={entries}
      />
    )
    expect(screen.getByText(/2 banners/i)).toBeInTheDocument()
  })

  it('renders one card per entry', () => {
    const entries = [makeEntry({ id: 'e-1' }), makeEntry({ id: 'e-2' })]
    render(
      <ScheduledBannersGrid
        {...gridDefaults}
        selectedDate="2026-03-30"
        entries={entries}
      />
    )
    // Each ready card renders a BannerPreview mock
    expect(screen.getAllByTestId('banner-preview')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// ScheduledBannerCard tests
// ---------------------------------------------------------------------------

describe('ScheduledBannerCard', () => {
  it('renders loading skeleton when status is loading', () => {
    const entry = makeEntry({ status: 'loading', bannerState: null })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByLabelText(/loading banner/i)).toBeInTheDocument()
  })

  it('renders error message when status is error', () => {
    const entry = makeEntry({ status: 'error', bannerState: null, error: 'Product not found' })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByText(/Product not found/i)).toBeInTheDocument()
  })

  it('renders BannerPreview and Export button when status is ready', () => {
    render(<ScheduledBannerCard entry={makeEntry()} />)
    expect(screen.getByTestId('banner-preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export banner/i })).toBeInTheDocument()
  })

  it('renders product name label for a ready entry', () => {
    render(<ScheduledBannerCard entry={makeEntry()} />)
    expect(screen.getByText('Juicy Mangoes')).toBeInTheDocument()
  })

  it('shows truncated offer callout text in error state', () => {
    const longCallout = 'Our price - 85 + Free delivery\n\n' + 'x'.repeat(200)
    const entry = makeEntry({
      status: 'error',
      bannerState: null,
      error: 'No product URL found in Offer callout',
      sheetRow: {
        date: '3/30/2026',
        team: 'bazar page',
        page: 'Banner',
        offerCallout: longCallout,
        comments: '',
      },
    })
    render(<ScheduledBannerCard entry={entry} />)
    // Error message should be shown
    expect(screen.getByText(/No product URL/i)).toBeInTheDocument()
  })

  it('renders nothing when status is ready but bannerState is null', () => {
    const entry = makeEntry({ status: 'ready', bannerState: null })
    const { container } = render(<ScheduledBannerCard entry={entry} />)
    expect(container.firstChild).toBeNull()
  })

  // -------------------------------------------------------------------------
  // ES-7: isEditing=true → button label is "Save"; onSave is called on click
  // -------------------------------------------------------------------------

  it('ES-7: renders "Save" button label when isEditing is true', () => {
    const onSave = vi.fn()
    const onEdit = vi.fn()
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        isEditing={true}
        onEdit={onEdit}
        onSave={onSave}
      />,
    )
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('ES-7: clicking Save button calls onSave (not onEdit) when isEditing is true', () => {
    const onSave = vi.fn()
    const onEdit = vi.fn()
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        isEditing={true}
        onEdit={onEdit}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // ES-8: isEditing=false → button label is "Edit"; onEdit is called on click
  // -------------------------------------------------------------------------

  it('ES-8: renders "Edit" button label when isEditing is false', () => {
    const onEdit = vi.fn()
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        isEditing={false}
        onEdit={onEdit}
      />,
    )
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  it('ES-8: clicking Edit button calls onEdit (not onSave) when isEditing is false', () => {
    const onSave = vi.fn()
    const onEdit = vi.fn()
    render(
      <ScheduledBannerCard
        entry={makeEntry()}
        isEditing={false}
        onEdit={onEdit}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// IT-21 — bg-version toggle pills live in BannerControls (not on the card)
// ---------------------------------------------------------------------------

describe('ScheduledBannerCard — bg-removed toggle pill (IT-21)', () => {
  it('does not render a bg-version toggle pill on the card itself', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedProductImageUrl: 'blob:product-result',
      showBgRemovedProduct: true,
      showBgRemovedLogo: true,
    })
    render(<ScheduledBannerCard entry={entry} />)
    // Pills now live in BannerControls (shown in edit mode), not on the card
    expect(screen.queryByText('BG Removed')).toBeNull()
    expect(screen.queryByText('Original')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// IT-22 — effectiveDisplayState injects bg-removed URLs into BannerPreview
// ---------------------------------------------------------------------------

describe('ScheduledBannerCard — effectiveDisplayState (IT-22)', () => {
  it('passes bgRemovedProductImageUrl as productImageOverride when showBgRemovedProduct is true', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedProductImageUrl: 'blob:bg-removed-product',
      bgRemovedLogoUrl: null,
      showBgRemovedProduct: true,
      showBgRemovedLogo: false,
      bannerState: makeBannerState({ productImageOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-product-image-override',
      'blob:bg-removed-product',
    )
  })

  it('passes empty productImageOverride when showBgRemovedProduct is false', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedProductImageUrl: 'blob:bg-removed-product',
      bgRemovedLogoUrl: null,
      showBgRemovedProduct: false,
      showBgRemovedLogo: false,
      bannerState: makeBannerState({ productImageOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-product-image-override',
      '',
    )
  })

  it('passes empty productImageOverride when bgRemovedProductImageUrl is null even if showBgRemovedProduct is true', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedProductImageUrl: null,
      bgRemovedLogoUrl: null,
      showBgRemovedProduct: true,
      showBgRemovedLogo: false,
      bannerState: makeBannerState({ productImageOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-product-image-override',
      '',
    )
  })
})
