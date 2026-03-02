/**
 * Banner layout constants for the 722×312px canvas.
 *
 * The canvas is split 50/50 at x=361:
 *   Left half  → logo, heading, CTA, T&C
 *   Right half → product image, offer badge
 *
 * All positions, sizes, and colours are driven from this file
 * so both BannerPreview (live) and exportService (capture) stay in sync.
 */

// --- Canvas ---
export const BANNER_WIDTH = 722;
export const BANNER_HEIGHT = 312;
export const BANNER_RADIUS = 24;
export const BANNER_FALLBACK_BG = '#FFFFFF';

// --- Left-half margin: all left-section elements share a 40px left offset ---
const LEFT_MARGIN = 40;

// --- Brand Logo (top-left) ---
export const BRAND_LOGO = {
  x: LEFT_MARGIN,
  y: 11,
  maxWidth: 120,
  /** Fixed height — scales small logos up to 40px, maintains aspect ratio */
  height: 40,
};

// --- Product Name / Heading ---
// Logo + heading form a vertical group bottom-anchored at y = 165.
// Gap between logo bottom and heading top = 8px.
export const PRODUCT_NAME = {
  x: LEFT_MARGIN,
  maxWidth: 320,
  fontFamily: '"Inter", sans-serif',
  fontWeight: 800,
  color: '#000000',
  lineHeight: 1.2,
  maxLines: 2,
  maxFontSize: 32,
  minFontSize: 18,
  fontSizeStep: 2,
  /** Bottom edge of the logo+heading group */
  groupBottomY: 165,
  /** Gap between logo bottom and heading top */
  logoHeadingGap: 8,
  /** When no logo, heading starts here */
  noLogoTopY: 22,
};

// --- Subheading Reserved Area (empty for now) ---
export const SUBHEADING = {
  x: LEFT_MARGIN,
  y: 180,
  height: 45,
  maxWidth: 320,
};

// --- CTA Button ---
export const CTA_BUTTON = {
  x: LEFT_MARGIN,
  y: 233,
  paddingX: 12,
  paddingY: 8,
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1,
  color: '#FFFFFF',
  borderRadius: 8,
  /** Default CTA background when no background is selected */
  defaultBg: '#457DD1',
};

// --- T&C Text (below CTA) ---
export const TNC_TEXT = {
  x: LEFT_MARGIN,
  /** Gap measured from the bottom edge of the CTA button box */
  gapBelowCta: 3,
  fontSize: 10,
  fontWeight: 400,
  color: '#000000',
  maxWidth: 320,
};

// --- Offer Badge (top-right, flush with canvas edges) ---
export const OFFER_BADGE = {
  paddingX: 16,
  paddingY: 8,
  fontSize: 24,
  fontWeight: 500,
  color: '#FFFFFF',
  backgroundColor: '#85929E',
  /** Asymmetric corners: TL=0, TR=matches canvas, BR=0, BL=8 */
  borderRadius: `0px ${BANNER_RADIUS}px 0px 8px`,
};

// --- Product Image (right half, bottom-aligned) ---
export const PRODUCT_IMAGE = {
  /** Horizontal centre of the right half: (361 + 722) / 2 */
  centerX: 541.5,
  maxWidth: 300,
  maxHeight: 280,
};
