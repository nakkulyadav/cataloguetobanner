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
  /** Raw source contains the full on_search payload including provider_details */
  raw_source?: {
    provider_details?: {
      id: string
      descriptor: ProviderDescriptor
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
  /** Uploaded product image blob URL override. null = use catalogue image. */
  productImageOverride: string | null;
}

// --- Logging ---

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
}
