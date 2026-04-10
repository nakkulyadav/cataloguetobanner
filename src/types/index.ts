// --- Provider & Product types ---

export interface ProviderDetails {
  brandName: string;
  brandLogo: string | null;
  companyName: string;
}

/** Formatted price pair for banner display (pre-formatted with ₹ prefix + commas) */
export interface ProductPrice {
  mrp: string;
  sellingPrice: string;
}

export interface ParsedProduct {
  id: string;
  name: string;
  shortDesc: string;
  imageUrl: string | undefined;
  hasValidImage: boolean;
  isVeg: boolean;
  isRelated: boolean;
  parentId: string | null;
  provider: ProviderDetails;
  /** Formatted prices from catalogue. Undefined when price data is missing/invalid. */
  price?: ProductPrice;
  /**
   * Auto-detected quantity sticker text from the catalogue.
   * Set when the item's unitized measure unit is "PACK", e.g. "PACK OF 5".
   * null when not applicable.
   */
  quantitySticker: string | null;
}

export interface ProductGroup {
  parent: ParsedProduct;
  children: ParsedProduct[];
}

// --- API response types ---

/** Descriptor shape shared by provider_details across top-level and raw_source */
export interface ProviderDescriptor {
  name: string
  symbol?: string
  images?: string[]
  long_desc?: string
  short_desc?: string
}

/** Shape of a single item returned by the Digihaat catalogue search API */
export interface ApiCatalogItem {
  id: string
  item_id: string
  item_name: string
  /** Top-level product image URL returned by the API */
  item_image?: string
  price: number
  mrp: number
  discount_percentage: number
  in_stock: boolean
  category: string
  city: string
  state: string
  bpp_id: string
  provider_name: string
  provider_unique_id: string
  total_items: number
  enabled_items: number
  /** Structured object (NOT stringified JSON) */
  item_details: {
    descriptor: {
      name: string
      images?: string[]
      symbol?: string
      long_desc?: string
      short_desc?: string
    }
    price?: {
      value: string | number
      maximum_value: string | number
      currency?: string
      discount_percentage?: number
    }
    quantity?: {
      available?: { count: string }
      maximum?: { count: string }
      /** Unitized package measure — source of the quantity sticker data */
      unitized?: {
        measure?: {
          unit: string
          value: string
        }
      }
    }
    tags?: Array<{
      code: string
      list: Array<{ code: string; value: string }>
    }>
    related?: boolean
    [key: string]: unknown
  }
  /** May be null for some BPPs — use raw_source.provider_details as fallback */
  provider_details: {
    id: string
    descriptor: ProviderDescriptor
    rating?: string
  } | null
  /** Raw source contains the full on_search payload including provider_details and item_details */
  raw_source?: {
    provider_details?: {
      id: string
      descriptor: ProviderDescriptor
    }
    /** Full ONDC item_details — used as fallback when top-level item_details is absent or incomplete */
    item_details?: {
      quantity?: {
        unitized?: {
          measure?: {
            unit: string
            value: string
          }
        }
      }
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Paginated response wrapper from the catalogue search API */
export interface ApiPaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Extracted unique provider from API item results */
export interface ApiProvider {
  id: string
  name: string
  logo: string | null
  totalItems: number
  enabledItems: number
  city: string
  state: string
}

/** Domain option for the ONDC category dropdown */
export interface DomainOption {
  code: string
  label: string
}

// --- Background options ---

export interface BackgroundOption {
  id: string;
  url: string;
  ctaColor: string;
  ctaTextColor: string;
}

// --- Image source ---

/**
 * A single product image available for the banner.
 * The catalogue image is always present when a product is selected;
 * additional user-uploaded/pasted images are appended as 'user' sources.
 * Each source independently tracks its own background-removal state so the
 * user can toggle between the original and bg-removed version per image.
 */
export interface ImageSource {
  /** Unique key — 'catalogue' for the product's catalogue image, UUID for user uploads */
  id: string;
  /** Display label shown in the image selector (e.g. "Catalogue", "Upload 1") */
  label: string;
  /**
   * Original image URL.
   * For 'catalogue' sources this is the product imageUrl from the catalogue.
   * For 'user' sources this is a blob: URL created from the uploaded file.
   */
  originalUrl: string;
  /** Blob URL of the background-removed version. null until processing completes. */
  bgRemovedUrl: string | null;
  /** Lifecycle of the background-removal worker for this image. */
  bgRemovalStatus: 'idle' | 'removing' | 'done' | 'error';
  /**
   * Whether to display the bg-removed version (true) or the original (false).
   * Automatically flipped to true after successful removal so the result is
   * immediately visible.
   */
  showBgRemoved: boolean;
  /** Origin — 'catalogue' sources cannot be removed from the list by the user. */
  source: 'catalogue' | 'user';
}

// --- Banner state ---

export interface BannerState {
  selectedProduct: ParsedProduct | null;
  selectedBackground: BackgroundOption | null;
  ctaText: string;
  badgeText: string;
  showTnc: boolean;
  showBadge: boolean;
  showPrice: boolean;
  /** Toggle visibility of the brand logo element on the banner */
  showLogo: boolean;
  /** Toggle visibility of the product name heading on the banner */
  showHeading: boolean;
  /** Toggle visibility of the CTA button on the banner */
  showCta: boolean;
  /** Toggle visibility of the subheading element (activates compact heading mode) */
  showSubheading: boolean;
  /** Custom text for the subheading element (shown when showSubheading is ON) */
  subheadingText: string;
  tncText: string;
  brandLogoOverride: string | null;
  /** Custom product name for the banner heading. null = use original catalogue name. */
  productNameOverride: string | null;
  /** Custom price override for the banner. null = use original catalogue prices. */
  priceOverride: ProductPrice | null;
  /**
   * All available product images for this banner.
   * Always contains the catalogue source when a product is selected.
   * User-uploaded/pasted images are appended as additional 'user' sources.
   * Each entry carries its own bg-removal state and show/hide toggle.
   */
  productImageSources: ImageSource[];
  /** ID of the currently displayed image source. null when list is empty. */
  activeProductImageSourceId: string | null;
  /**
   * All available brand logo images for this banner.
   * Always contains a 'catalogue' source when the product's provider has a brandLogo.
   * User-uploaded/pasted logos are appended as additional 'user' sources.
   * Each entry carries its own bg-removal state and show/hide toggle.
   */
  logoImageSources: ImageSource[];
  /** ID of the currently displayed logo source. null when list is empty. */
  activeLogoImageSourceId: string | null;
  /**
   * Scale factor applied to the brand logo image (1 = 100%, 0.5 = 50%, 2 = 200%).
   * Uses CSS transform:scale() so the layout box remains fixed.
   */
  logoScale: number;
  /**
   * Scale factor applied to the product image (1 = 100%, 0.5 = 50%, 2 = 200%).
   * Uses CSS transform:scale() so the layout box remains fixed.
   */
  productImageScale: number;
  /**
   * Editable text for the quantity sticker pill overlaid on the product image.
   * null = no sticker displayed (even when showQuantitySticker is true).
   * Auto-populated from ParsedProduct.quantitySticker on product select.
   */
  quantityStickerText: string | null;
  /** Whether the quantity sticker pill is visible on the banner. */
  showQuantitySticker: boolean;
}

// --- Scheduled Banners (Google Sheets integration) ---

/**
 * A single row parsed from the Digihaat promotions Google Sheet.
 * Column names are mapped verbatim; empty cells become empty strings.
 */
export interface SheetRow {
  /** MM/DD/YYYY — the promotion date from the "Date" column */
  date: string;
  /** Originating team, e.g. "bazaar" — from the "Team" column */
  team: string;
  /** Placement type, e.g. "Banner" — from the "Page Homepage/Food/Grocery etc" column */
  page: string;
  /**
   * Raw text from the "Offer callout" column.
   * Contains both a human-readable price string AND a digihaat.in product URL
   * on separate lines, e.g.:
   *   "Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?..."
   */
  offerCallout: string;
  /**
   * Raw text from the "Comments" column.
   * Contains "Header: ..." and "Subheader: ..." labels on separate lines.
   */
  comments: string;
  /**
   * Value from the optional "quantity sticker" column.
   * Empty string when the column is absent or the cell is blank.
   */
  quantitySticker: string;
}

/**
 * One entry in the scheduled banner batch for a selected date.
 * Wraps the source sheet row plus the resolved BannerState (once loaded).
 */
export interface ScheduledBannerEntry {
  /** Unique key for React list rendering — generated from row index */
  id: string;
  /** The originating sheet row */
  sheetRow: SheetRow;
  /** Lifecycle status of the async product lookup */
  status: 'loading' | 'ready' | 'error';
  /**
   * Fully assembled banner state, available once status === 'ready'.
   * Includes product data from the API merged with sheet overrides
   * (price, heading, subheading).
   *
   * Product image and logo bg-removal state lives inside each ImageSource entry in
   * `bannerState.productImageSources` / `bannerState.logoImageSources`, allowing
   * per-image toggle between original and bg-removed versions without re-running WASM.
   */
  bannerState: BannerState | null;
  /** Human-readable error message, set when status === 'error' */
  error: string | null;
  /**
   * Overall lifecycle of background removal for this entry.
   * Reflects the combined status across all product image sources and logo sources.
   *
   *   idle     — not yet processed (initial state)
   *   removing — at least one image is currently being processed
   *   done     — all images processed (individual source errors noted in bgRemovalError)
   *   error    — processing failed entirely; bgRemovalError holds the reason
   */
  bgRemovalStatus: 'idle' | 'removing' | 'done' | 'error';
  /** Human-readable failure reason, set when bgRemovalStatus === 'error' */
  bgRemovalError: string | null;
}

// --- Logging ---

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
}
