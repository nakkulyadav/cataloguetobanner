// --- Provider & Product types ---

export interface ProviderDetails {
  brandName: string;
  brandLogo: string | null;
  companyName: string;
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
  tncText: string;
  brandLogoOverride: string | null;
  /** Custom product name for the banner heading. null = use original catalogue name. */
  productNameOverride: string | null;
}

// --- Logging ---

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
}
