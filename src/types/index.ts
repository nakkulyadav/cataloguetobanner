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

// --- Raw catalogue JSON shape ---

export interface RawCatalogueEntry {
  item_details: string;
  provider_details: string;
  /** Stringified JSON array of product image URLs (newer catalogue format) */
  item_images?: string;
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
