import { forwardRef, useRef, useState, useEffect } from 'react'
import type { BannerState } from '@/types'
import {
  BANNER_WIDTH,
  BANNER_HEIGHT,
  BANNER_RADIUS,
  BANNER_FALLBACK_BG,
  BRAND_LOGO,
  PRODUCT_NAME,
  CTA_BUTTON,
  TNC_TEXT,
  OFFER_BADGE,
  PRODUCT_IMAGE,
  PRICE_DISPLAY,
  SUBHEADING,
  SUBHEADING_TEXT,
} from '@/constants/bannerTemplate'

interface BannerPreviewProps {
  state: BannerState
}

/**
 * The 722×312px banner preview component.
 *
 * Layout: 50/50 split at x=361.
 *   Left  → logo, product name, CTA, T&C
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
      subheadingText,
      tncText,
      brandLogoOverride,
      productNameOverride,
      priceOverride,
    } = state

    const brandLogo = brandLogoOverride ?? selectedProduct?.provider.brandLogo ?? null

    // Use the override if set, otherwise fall back to the catalogue name
    const displayName = productNameOverride ?? selectedProduct?.name

    // Use price override if set, otherwise fall back to catalogue prices
    const displayPrice = priceOverride ?? selectedProduct?.price

    // --- Adaptive font sizing for product name ---
    const headingMeasureRef = useRef<HTMLDivElement>(null)
    const [headingFontSize, setHeadingFontSize] = useState(PRODUCT_NAME.maxFontSize)

    useEffect(() => {
      const el = headingMeasureRef.current
      if (!el || !displayName) return

      const { maxWidth, maxLines, lineHeight, maxFontSize, minFontSize, fontSizeStep, fontWeight, fontFamily } = PRODUCT_NAME

      for (let size = maxFontSize; size >= minFontSize; size -= fontSizeStep) {
        el.style.fontSize = `${size}px`
        el.style.lineHeight = `${lineHeight}`
        el.style.fontWeight = String(fontWeight)
        el.style.fontFamily = fontFamily
        el.style.width = `${maxWidth}px`
        el.style.wordBreak = 'break-word'
        el.style.whiteSpace = 'normal'
        el.textContent = displayName

        const maxHeight = maxLines * size * lineHeight
        if (el.scrollHeight <= maxHeight + 1) {
          setHeadingFontSize(size)
          return
        }
      }
      setHeadingFontSize(minFontSize)
    }, [displayName])

    // --- Compute logo+heading group position (bottom-anchored at groupBottomY) ---
    const logoHeight = brandLogo ? BRAND_LOGO.height : 0
    const gapHeight = brandLogo ? PRODUCT_NAME.logoHeadingGap : 0
    const headingLineHeight = headingFontSize * PRODUCT_NAME.lineHeight
    const headingMaxHeight = PRODUCT_NAME.maxLines * headingLineHeight
    const totalGroupHeight = logoHeight + gapHeight + headingMaxHeight

    let groupTopY: number
    if (brandLogo) {
      // Bottom-anchor the group at groupBottomY
      groupTopY = PRODUCT_NAME.groupBottomY - totalGroupHeight
    } else {
      // No logo — heading starts at the top
      groupTopY = PRODUCT_NAME.noLogoTopY
    }

    const logoY = groupTopY
    const headingY = groupTopY + logoHeight + gapHeight

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

        {/* Brand Logo (top-left, within the group) */}
        {brandLogo && (
          <img
            src={brandLogo}
            alt={selectedProduct?.provider.brandName ?? ''}
            style={{
              position: 'absolute',
              left: BRAND_LOGO.x,
              top: logoY,
              width: BRAND_LOGO.width,
              height: BRAND_LOGO.height,
              objectFit: 'contain',
              objectPosition: 'left',
            }}
          />
        )}

        {/* Product Name (adaptive font, max 2 lines, supports override) */}
        {displayName && (
          <div
            style={{
              position: 'absolute',
              left: PRODUCT_NAME.x,
              top: headingY,
              width: PRODUCT_NAME.maxWidth,
              fontSize: headingFontSize,
              fontWeight: PRODUCT_NAME.fontWeight,
              color: PRODUCT_NAME.color,
              lineHeight: PRODUCT_NAME.lineHeight,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: PRODUCT_NAME.maxLines,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {displayName}
          </div>
        )}

        {/* Price Display (subheading area, bottom-aligned at bottomY) */}
        {showPrice && displayPrice && (
          <div
            style={{
              position: 'absolute',
              left: PRICE_DISPLAY.x,
              bottom: BANNER_HEIGHT - PRICE_DISPLAY.bottomY,
              display: 'flex',
              alignItems: 'flex-end',
              gap: PRICE_DISPLAY.gap,
            }}
          >
            <span
              style={{
                fontSize: PRICE_DISPLAY.mrp.fontSize,
                fontWeight: PRICE_DISPLAY.mrp.fontWeight,
                color: PRICE_DISPLAY.mrp.color,
                fontFamily: PRICE_DISPLAY.mrp.fontFamily,
                textDecoration: PRICE_DISPLAY.mrp.textDecoration,
                lineHeight: 1,
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
                lineHeight: 1,
              }}
            >
              {displayPrice.sellingPrice}
            </span>
          </div>
        )}

        {/* Subheading Text (shown in subheading area when price is off) */}
        {!showPrice && subheadingText && (
          <div
            style={{
              position: 'absolute',
              left: SUBHEADING.x,
              top: SUBHEADING.y,
              maxWidth: SUBHEADING.maxWidth,
              fontSize: SUBHEADING_TEXT.fontSize,
              fontWeight: SUBHEADING_TEXT.fontWeight,
              color: SUBHEADING_TEXT.color,
              fontFamily: SUBHEADING_TEXT.fontFamily,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              lineHeight: 1,
            }}
          >
            {subheadingText}
          </div>
        )}

        {/* CTA Button */}
        <div
          style={{
            position: 'absolute',
            left: CTA_BUTTON.x,
            top: CTA_BUTTON.y,
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

        {/* T&C Text (8px below CTA button box edge) */}
        {showTnc && (
          <div
            style={{
              position: 'absolute',
              left: TNC_TEXT.x,
              // CTA box height = paddingY + fontSize*lineHeight + paddingY
              top: CTA_BUTTON.y
                + CTA_BUTTON.paddingY
                + CTA_BUTTON.fontSize * CTA_BUTTON.lineHeight
                + CTA_BUTTON.paddingY
                + TNC_TEXT.gapBelowCta,
              fontSize: TNC_TEXT.fontSize,
              fontWeight: TNC_TEXT.fontWeight,
              color: TNC_TEXT.color,
              maxWidth: TNC_TEXT.maxWidth,
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
        {selectedProduct?.hasValidImage && (
          <img
            src={selectedProduct.imageUrl}
            alt={selectedProduct.name}
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
