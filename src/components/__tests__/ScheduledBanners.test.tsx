import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScheduledBannersGrid from '@/components/DateSchedule/ScheduledBannersGrid'
import ScheduledBannerCard from '@/components/DateSchedule/ScheduledBannerCard'
import type { ScheduledBannerEntry, BannerState, ParsedProduct } from '@/types'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'

// ---------------------------------------------------------------------------
// Mock BannerPreview
// ---------------------------------------------------------------------------
vi.mock('@/components/BannerPreview/BannerPreview', () => ({
  default: vi.fn(({ state }: { state: import('@/types').BannerState | null }, _ref: unknown) => (
    <div
      data-testid="banner-preview"
      data-brand-logo-override={state?.brandLogoOverride ?? ''}
    />
  )),
}))

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
    quantitySticker: null,
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
    productImageSources: [],
    activeProductImageSourceId: null,
    logoImageSources: [],
    activeLogoImageSourceId: null,
    logoScale: 1,
    productImageScale: 1,
    quantityStickerText: null,
    showQuantitySticker: false,
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
      productUrl: 'https://digihaat.in/en/product?item_id=abc',
      price: '₹85',
      heading: 'Juicy Mangoes',
      subheading: 'Starting at ₹85',
      quantitySticker: '',
    },
    status: 'ready',
    bannerState: makeBannerState(),
    error: null,
    bgRemovalStatus: 'idle',
    bgRemovalError: null,
    bgRemovedLogoUrl: null,
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
        productUrl: longCallout,
        price: '',
        heading: '',
        subheading: '',
        quantitySticker: '',
      },
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByText(/No product URL/i)).toBeInTheDocument()
  })

  it('renders nothing when status is ready but bannerState is null', () => {
    const entry = makeEntry({ status: 'ready', bannerState: null })
    const { container } = render(<ScheduledBannerCard entry={entry} />)
    expect(container.firstChild).toBeNull()
  })

  // ES-7 / ES-8
  it('renders "Save" button when isEditing is true', () => {
    render(<ScheduledBannerCard entry={makeEntry()} isEditing={true} onSave={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('clicking Save calls onSave', () => {
    const onSave = vi.fn()
    render(<ScheduledBannerCard entry={makeEntry()} isEditing={true} onSave={onSave} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('renders "Edit" button when isEditing is false', () => {
    render(<ScheduledBannerCard entry={makeEntry()} isEditing={false} onEdit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  it('clicking Edit calls onEdit', () => {
    const onEdit = vi.fn()
    render(<ScheduledBannerCard entry={makeEntry()} isEditing={false} onEdit={onEdit} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ISL-8: effectiveDisplayState injects bg-removed logo URL
// ---------------------------------------------------------------------------

describe('ScheduledBannerCard — effectiveDisplayState (ISL-8)', () => {
  it('passes bgRemovedLogoUrl as brandLogoOverride when showBgRemovedLogo is true', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedLogoUrl: 'blob:logo-result',
      showBgRemovedLogo: true,
      bannerState: makeBannerState({ brandLogoOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-brand-logo-override',
      'blob:logo-result',
    )
  })

  it('does not inject logo override when showBgRemovedLogo is false', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedLogoUrl: 'blob:logo-result',
      showBgRemovedLogo: false,
      bannerState: makeBannerState({ brandLogoOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-brand-logo-override',
      '',
    )
  })

  it('does not inject logo override when bgRemovedLogoUrl is null', () => {
    const entry = makeEntry({
      bgRemovalStatus: 'done',
      bgRemovedLogoUrl: null,
      showBgRemovedLogo: true,
      bannerState: makeBannerState({ brandLogoOverride: null }),
    })
    render(<ScheduledBannerCard entry={entry} />)
    expect(screen.getByTestId('banner-preview')).toHaveAttribute(
      'data-brand-logo-override',
      '',
    )
  })
})
