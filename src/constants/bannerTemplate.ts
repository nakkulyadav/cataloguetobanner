/**
 * Banner layout constants for the 722×312px canvas.
 *
 * The canvas is split 50/50 at x=361:
 *   Left half  → logo, heading, subheading, price, CTA, T&C
 *                (vertically centered via dynamic layout in BannerPreview)
 *   Right half → product image, offer badge
 *
 * All styling, sizes, and colours are driven from this file.
 * Vertical positions are computed dynamically — no hardcoded `y` values.
 */

// --- Canvas ---
export const BANNER_WIDTH = 722;
export const BANNER_HEIGHT = 312;
export const BANNER_RADIUS = 24;
export const BANNER_FALLBACK_BG = '#FFFFFF';

// --- Left-half margin: all left-section elements share a 40px left offset ---
const LEFT_MARGIN = 40;

// --- Left-section vertical bounds ---
// Content is centered within [TOP_PADDING, BANNER_HEIGHT - BOTTOM_PADDING].
export const LEFT_SECTION_TOP_PADDING = 20;
export const LEFT_SECTION_BOTTOM_PADDING = 20;

// --- Brand Logo ---
export const BRAND_LOGO = {
  x: LEFT_MARGIN,
  width: 370,
  /** Fixed height — objectFit:contain scales logos up/down to fit this box */
  height: 50,
};

// --- Product Name / Heading ---
export const PRODUCT_NAME = {
  x: LEFT_MARGIN,
  maxWidth: 370,
  fontFamily: '"Inter", sans-serif',
  fontWeight: 700,
  color: '#000000',
  lineHeight: 1.2,
  maxLines: 2,
  maxFontSize: 32,
  minFontSize: 22,
  fontSizeStep: 1,
};

// --- Heading Compact Mode (active when subheading is toggled ON) ---
// Fixed single-line heading: smaller font, lighter weight, no adaptive sizing.
export const HEADING_COMPACT = {
  fontWeight: 600,
  lineHeight: 1.2,
  maxLines: 1,
  maxFontSize: 28,
  minFontSize: 24,
  fontSizeStep: 1,
};

// --- Subheading Position ---
export const SUBHEADING = {
  x: LEFT_MARGIN,
  maxWidth: 370,
};

// --- Subheading Text (independent element between heading and price) ---
export const SUBHEADING_TEXT = {
  fontSize: 24,
  fontWeight: 400,
  color: '#000000',
  fontFamily: '"Inter", sans-serif',
  /** lineHeight: 1.2 leaves room for descenders (g, y, p, q) */
  lineHeight: 1.2,
};

// --- Price Display (independent element below subheading) ---
export const PRICE_DISPLAY = {
  x: LEFT_MARGIN,
  /** Horizontal gap between MRP and selling price */
  gap: 8,
  mrp: {
    fontSize: 24,
    fontWeight: 500,
    color: '#000000',
    fontFamily: '"Inter", sans-serif',
    textDecoration: 'line-through' as const,
    /** lineHeight: 1 codifies the value already used in JSX */
    lineHeight: 1,
  },
  sellingPrice: {
    fontSize: 32,
    fontWeight: 700,
    color: '#000000',
    fontFamily: '"Inter", sans-serif',
    /** lineHeight: 1 codifies the value already used in JSX */
    lineHeight: 1,
  },
};

// --- CTA Button ---
export const CTA_BUTTON = {
  x: LEFT_MARGIN,
  paddingX: 12,
  paddingY: 8,
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.1,
  color: '#FFFFFF',
  borderRadius: 8,
  /** Default CTA background when no background is selected */
  defaultBg: '#457DD1',
};

// --- T&C Text ---
export const TNC_TEXT = {
  x: LEFT_MARGIN,
  fontSize: 14,
  fontWeight: 500,
  color: '#000000',
  maxWidth: 370,
  /** lineHeight: 1.2 ensures height = fontSize * 1.2 = TNC_HEIGHT */
  lineHeight: 1.2,
};

// --- Offer Badge (top-right, flush with canvas edges) ---
export const OFFER_BADGE = {
  paddingX: 12,
  paddingY: 4,
  fontSize: 20,
  fontWeight: 500,
  color: '#FFFFFF',
  backgroundColor: '#85929E',
  /** Asymmetric corners: TL=0, TR=matches canvas, BR=0, BL=8 */
  borderRadius: `0px ${BANNER_RADIUS}px 0px 8px`,
};

// --- Dynamic left-section layout ---
// Preset gaps between adjacent visible elements (px).
// When an element is hidden, its neighbors collapse using the fallback lookup
// in getGapBetween() which walks the ordered element list.
export const LEFT_SECTION_GAPS: Record<string, number> = {
  'logo-heading': 10,
  'heading-subheading': 5,  // compact heading → subheading
  'heading-price': 10,       // normal heading → price (subheading off)
  'subheading-price': 20,    // subheading → price
  'subheading-cta': 15,      // subheading → CTA (when price is off)
  'price-cta': 15,           // price → CTA
  'cta-tnc': 3,
};

/** Price row height: selling price font size with lineHeight:1 */
export const PRICE_HEIGHT = PRICE_DISPLAY.sellingPrice.fontSize;

/** Subheading text height: fontSize * lineHeight */
export const SUBHEADING_TEXT_HEIGHT = SUBHEADING_TEXT.fontSize * SUBHEADING_TEXT.lineHeight;

/** CTA box height: paddingY*2 + fontSize*lineHeight */
export const CTA_HEIGHT = CTA_BUTTON.paddingY * 2 + CTA_BUTTON.fontSize * CTA_BUTTON.lineHeight;

/** T&C text height: fontSize * lineHeight */
export const TNC_HEIGHT = TNC_TEXT.fontSize * TNC_TEXT.lineHeight;

// --- Product Image (right half, bottom-aligned) ---
export const PRODUCT_IMAGE = {
  /** Horizontal centre of the right half: (361 + 722) / 2 */
  centerX: 550,
  width: 300,
  height: 270,
  bottomOffset: 3,
};
