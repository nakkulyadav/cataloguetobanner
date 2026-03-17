import { forwardRef, useRef, useState, useEffect, useMemo } from 'react'
import type { BannerState } from '@/types'
import {
  BANNER_WIDTH,
  BANNER_HEIGHT,
  BANNER_RADIUS,
  BANNER_FALLBACK_BG,
  BRAND_LOGO,
  PRODUCT_NAME,
  HEADING_COMPACT,
  CTA_BUTTON,
  TNC_TEXT,
  OFFER_BADGE,
  PRODUCT_IMAGE,
  PRICE_DISPLAY,
  SUBHEADING,
  SUBHEADING_TEXT,
  LEFT_SECTION_GAPS,
  LEFT_SECTION_TOP_PADDING,
  LEFT_SECTION_BOTTOM_PADDING,
  PRICE_HEIGHT,
  SUBHEADING_TEXT_HEIGHT,
  CTA_HEIGHT,
  TNC_HEIGHT,
} from '@/constants/bannerTemplate'

interface BannerPreviewProps {
  state: BannerState
}

// --- Element identifiers for the dynamic layout system ---
type ElementId = 'logo' | 'heading' | 'subheading' | 'price' | 'cta' | 'tnc'

/**
 * Look up the gap between two adjacent visible elements.
 * Falls back to the gap keyed by the earlier element when elements
 * between them are hidden (e.g. logo→cta uses logo→heading gap).
 */
function getGapBetween(a: ElementId, b: ElementId): number {
  const key = `${a}-${b}`
  const direct = LEFT_SECTION_GAPS[key]
  if (direct !== undefined) return direct

  // For non-adjacent pairs, use the gap defined for the earlier element's
  // natural next neighbour. The ordered list ensures correct lookup.
  const ordered: ElementId[] = ['logo', 'heading', 'subheading', 'price', 'cta', 'tnc']
  const idxA = ordered.indexOf(a)
  for (let i = idxA; i < ordered.length - 1; i++) {
    const gapKey = `${ordered[i]}-${ordered[i + 1]}`
    const gap = LEFT_SECTION_GAPS[gapKey]
    if (gap !== undefined) return gap
  }

  return 15 // safe default
}

/**
 * The 722×312px banner preview component.
 *
 * Layout: 50/50 split at x=361.
 *   Left  → logo, heading, subheading, price, CTA, T&C
 *            Positions are dynamically computed and vertically centered
 *            based on which elements are visible.
 *   Right → product image (bottom-aligned), offer badge (top-right flush)
 */
const BannerPreview = forwardRef<HTMLDivElement, BannerPreviewProps>(
  ({ state }, ref) => {
    const {
      selectedProduct,
      selectedBackground,
      ctaText,
      badgeText,
      showTnc,
      showBadge,
      showPrice,
      showLogo,
      showHeading,
      showCta,
      showSubheading,
      subheadingText,
      tncText,
      brandLogoOverride,
      productNameOverride,
      priceOverride,
      productImageOverride,
    } = state

    const brandLogo = brandLogoOverride ?? selectedProduct?.provider.brandLogo ?? null

    // Use the override if set, otherwise fall back to the catalogue name
    const displayName = productNameOverride ?? selectedProduct?.name

    // Use price override if set, otherwise fall back to catalogue prices
    const displayPrice = priceOverride ?? selectedProduct?.price

    // Effective product image: override > catalogue
    const effectiveImageUrl = productImageOverride ?? selectedProduct?.imageUrl
    const hasValidImage = productImageOverride
      ? true
      : selectedProduct?.hasValidImage ?? false

    // --- Heading config: normal vs compact ---
    // When subheading is active, heading shrinks to a fixed single-line compact mode.
    const headingConfig = showSubheading
      ? {
        fontSize: HEADING_COMPACT.maxFontSize,
        fontWeight: HEADING_COMPACT.fontWeight,
        lineHeight: HEADING_COMPACT.lineHeight,
        maxLines: HEADING_COMPACT.maxLines,
        minFontSize: HEADING_COMPACT.minFontSize,
        fontSizeStep: HEADING_COMPACT.fontSizeStep,
      }
      : {
        fontSize: PRODUCT_NAME.maxFontSize,
        fontWeight: PRODUCT_NAME.fontWeight,
        lineHeight: PRODUCT_NAME.lineHeight,
        maxLines: PRODUCT_NAME.maxLines,
        minFontSize: PRODUCT_NAME.minFontSize,
        fontSizeStep: PRODUCT_NAME.fontSizeStep,
      }

    // --- Adaptive font sizing for product name ---
    const headingMeasureRef = useRef<HTMLDivElement>(null)
    const [headingFontSize, setHeadingFontSize] = useState(PRODUCT_NAME.maxFontSize)
    // Actual rendered height of the heading text (measured from DOM, not maxLines)
    const [actualHeadingHeight, setActualHeadingHeight] = useState(
      PRODUCT_NAME.maxFontSize * PRODUCT_NAME.lineHeight,
    )

    useEffect(() => {
      const el = headingMeasureRef.current
      if (!el || !displayName) return

      const { maxWidth, fontFamily } = PRODUCT_NAME
      const { fontSize: maxSize, minFontSize: minSize, fontSizeStep: step, fontWeight: weight, lineHeight: lh, maxLines } = headingConfig

      for (let size = maxSize; size >= minSize; size -= step) {
        el.style.fontSize = `${size}px`
        el.style.lineHeight = `${lh}`
        el.style.fontWeight = String(weight)
        el.style.fontFamily = fontFamily
        el.style.width = `${maxWidth}px`
        el.style.wordBreak = 'break-word'
        el.style.whiteSpace = 'normal'
        el.textContent = displayName

        const maxHeight = maxLines * size * lh
        if (el.scrollHeight <= maxHeight + 1) {
          setHeadingFontSize(size)
          setActualHeadingHeight(el.scrollHeight)
          return
        }
      }
      setHeadingFontSize(minSize)
      // At min font size, cap at max allowed height
      setActualHeadingHeight(Math.min(el.scrollHeight, maxLines * minSize * lh))
    }, [displayName, headingConfig])

    // Use the actual measured height for layout, not the theoretical max
    const headingHeight = actualHeadingHeight

    // --- Determine which elements are visible and their heights ---
    const visibleElements = useMemo(() => {
      const elements: Array<{ id: ElementId; height: number }> = []

      if (showLogo && brandLogo) {
        elements.push({ id: 'logo', height: BRAND_LOGO.height })
      }
      if (showHeading && displayName) {
        elements.push({ id: 'heading', height: headingHeight })
      }
      if (showSubheading && subheadingText) {
        elements.push({ id: 'subheading', height: SUBHEADING_TEXT_HEIGHT })
      }
      if (showPrice && displayPrice) {
        elements.push({ id: 'price', height: PRICE_HEIGHT })
      }
      if (showCta) {
        elements.push({ id: 'cta', height: CTA_HEIGHT })
      }
      if (showTnc) {
        elements.push({ id: 'tnc', height: TNC_HEIGHT })
      }

      return elements
    }, [showLogo, brandLogo, showHeading, displayName, headingHeight, showSubheading, subheadingText, showPrice, displayPrice, showCta, showTnc])

    // --- Compute dynamic vertical positions ---
    // Elements are vertically centered as a group within the banner height.
    const positions = useMemo(() => {
      const posMap: Partial<Record<ElementId, number>> = {}
      if (visibleElements.length === 0) return posMap

      // Total height = sum of element heights + gaps between consecutive elements
      let totalHeight = 0
      for (let i = 0; i < visibleElements.length; i++) {
        const el = visibleElements[i]!
        totalHeight += el.height
        const next = visibleElements[i + 1]
        if (next) {
          totalHeight += getGapBetween(el.id, next.id)
        }
      }

      // Center the group within the padded vertical bounds
      const usableHeight = BANNER_HEIGHT - LEFT_SECTION_TOP_PADDING - LEFT_SECTION_BOTTOM_PADDING
      let currentY = LEFT_SECTION_TOP_PADDING + Math.max(0, (usableHeight - totalHeight) / 2)

      for (let i = 0; i < visibleElements.length; i++) {
        const el = visibleElements[i]!
        posMap[el.id] = currentY
        currentY += el.height
        const next = visibleElements[i + 1]
        if (next) {
          currentY += getGapBetween(el.id, next.id)
        }
      }

      return posMap
    }, [visibleElements])

    // CTA background colour comes from the selected background
    const ctaBgColor = selectedBackground?.ctaColor ?? CTA_BUTTON.defaultBg
    const ctaTextColor = selectedBackground?.ctaTextColor ?? CTA_BUTTON.color

    return (
      <div
        ref={ref}
        style={{
          width: BANNER_WIDTH,
          height: BANNER_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: BANNER_RADIUS,
          fontFamily: PRODUCT_NAME.fontFamily,
          backgroundColor: BANNER_FALLBACK_BG,
        }}
      >
        {/* Hidden element for measuring text */}
        <div
          ref={headingMeasureRef}
          style={{ position: 'absolute', visibility: 'hidden', top: -9999, left: -9999 }}
          aria-hidden="true"
        />

        {/* Background image (full bleed) */}
        {selectedBackground && (
          <img
            src={selectedBackground.url}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Brand Logo (dynamically positioned) */}
        {showLogo && brandLogo && positions.logo !== undefined && (
          <img
            src={brandLogo}
            alt={selectedProduct?.provider.brandName ?? ''}
            style={{
              position: 'absolute',
              left: BRAND_LOGO.x,
              top: positions.logo,
              width: BRAND_LOGO.width,
              height: BRAND_LOGO.height,
              objectFit: 'contain',
              objectPosition: 'left',
            }}
          />
        )}

        {/* Product Name — normal (adaptive multi-line) or compact (fixed single-line) */}
        {showHeading && displayName && positions.heading !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: PRODUCT_NAME.x,
              top: positions.heading,
              width: PRODUCT_NAME.maxWidth,
              height: headingHeight,
              fontSize: headingFontSize,
              fontWeight: headingConfig.fontWeight,
              color: PRODUCT_NAME.color,
              lineHeight: headingConfig.lineHeight,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: headingConfig.maxLines,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {displayName}
          </div>
        )}

        {/* Subheading Text (independent element, shown when showSubheading is ON) */}
        {showSubheading && subheadingText && positions.subheading !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: SUBHEADING.x,
              top: positions.subheading,
              maxWidth: SUBHEADING.maxWidth,
              height: SUBHEADING_TEXT_HEIGHT,
              fontSize: SUBHEADING_TEXT.fontSize,
              fontWeight: SUBHEADING_TEXT.fontWeight,
              color: SUBHEADING_TEXT.color,
              fontFamily: SUBHEADING_TEXT.fontFamily,
              lineHeight: SUBHEADING_TEXT.lineHeight,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {subheadingText}
          </div>
        )}

        {/* Price Display (independent element, baseline-aligned MRP + selling price) */}
        {showPrice && displayPrice && positions.price !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: PRICE_DISPLAY.x,
              top: positions.price,
              height: PRICE_HEIGHT,
              display: 'flex',
              alignItems: 'baseline',
              gap: PRICE_DISPLAY.gap,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: PRICE_DISPLAY.mrp.fontSize,
                fontWeight: PRICE_DISPLAY.mrp.fontWeight,
                color: PRICE_DISPLAY.mrp.color,
                fontFamily: PRICE_DISPLAY.mrp.fontFamily,
                textDecoration: PRICE_DISPLAY.mrp.textDecoration,
                lineHeight: PRICE_DISPLAY.mrp.lineHeight,
              }}
            >
              {displayPrice.mrp}
            </span>
            <span
              style={{
                fontSize: PRICE_DISPLAY.sellingPrice.fontSize,
                fontWeight: PRICE_DISPLAY.sellingPrice.fontWeight,
                color: PRICE_DISPLAY.sellingPrice.color,
                fontFamily: PRICE_DISPLAY.sellingPrice.fontFamily,
                lineHeight: PRICE_DISPLAY.sellingPrice.lineHeight,
              }}
            >
              {displayPrice.sellingPrice}
            </span>
          </div>
        )}

        {/* CTA Button (dynamically positioned) */}
        {showCta && positions.cta !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: CTA_BUTTON.x,
              top: positions.cta,
              height: CTA_HEIGHT,
              boxSizing: 'border-box' as const,
              paddingLeft: CTA_BUTTON.paddingX,
              paddingRight: CTA_BUTTON.paddingX,
              paddingTop: CTA_BUTTON.paddingY,
              paddingBottom: CTA_BUTTON.paddingY,
              fontSize: CTA_BUTTON.fontSize,
              fontWeight: CTA_BUTTON.fontWeight,
              lineHeight: CTA_BUTTON.lineHeight,
              color: ctaTextColor,
              backgroundColor: ctaBgColor,
              borderRadius: CTA_BUTTON.borderRadius,
              whiteSpace: 'nowrap',
            }}
          >
            {ctaText}
          </div>
        )}

        {/* T&C Text (dynamically positioned below CTA) */}
        {showTnc && positions.tnc !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: TNC_TEXT.x,
              top: positions.tnc,
              height: TNC_HEIGHT,
              fontSize: TNC_TEXT.fontSize,
              fontWeight: TNC_TEXT.fontWeight,
              color: TNC_TEXT.color,
              lineHeight: TNC_TEXT.lineHeight,
              maxWidth: TNC_TEXT.maxWidth,
              overflow: 'hidden',
            }}
          >
            {tncText}
          </div>
        )}

        {/* Offer Badge (top-right, flush with canvas edges) */}
        {showBadge && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              paddingLeft: OFFER_BADGE.paddingX,
              paddingRight: OFFER_BADGE.paddingX,
              paddingTop: OFFER_BADGE.paddingY,
              paddingBottom: OFFER_BADGE.paddingY,
              fontSize: OFFER_BADGE.fontSize,
              fontWeight: OFFER_BADGE.fontWeight,
              color: OFFER_BADGE.color,
              backgroundColor: OFFER_BADGE.backgroundColor,
              borderRadius: OFFER_BADGE.borderRadius,
              whiteSpace: 'nowrap',
            }}
          >
            {badgeText}
          </div>
        )}

        {/* Product Image (right half, bottom-aligned, centered at x=541.5) */}
        {hasValidImage && effectiveImageUrl && (
          <img
            src={effectiveImageUrl}
            alt={selectedProduct?.name ?? 'Product'}
            style={{
              position: 'absolute',
              bottom: PRODUCT_IMAGE.bottomOffset,
              left: PRODUCT_IMAGE.centerX,
              transform: 'translateX(-50%)',
              width: PRODUCT_IMAGE.width,
              height: PRODUCT_IMAGE.height,
              objectFit: 'contain',
            }}
          />
        )}
      </div>
    )
  },
)

BannerPreview.displayName = 'BannerPreview'

export default BannerPreview
