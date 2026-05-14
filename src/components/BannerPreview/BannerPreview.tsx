import { forwardRef, useRef, useState, useEffect, useMemo } from 'react'

/**
 * Proxy external images through the Worker so html-to-image can fetch them (CORS).
 * In dev, Vite has no /api/image handler so we return the original URL — images
 * still display fine; only canvas export would lack CORS headers in dev.
 */
function proxyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (import.meta.env.DEV) return url
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url
  return `/api/image?url=${encodeURIComponent(url)}`
}
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
  IMAGE_LEFT_BARRIER,
  PRICE_DISPLAY,
  SUBHEADING,
  SUBHEADING_TEXT,
  LEFT_SECTION_GAPS,
  LEFT_SECTION_TOP_PADDING,
  LEFT_SECTION_BOTTOM_PADDING,
  LOGO_MIN_TOP_PADDING,
  PRICE_HEIGHT,
  SUBHEADING_TEXT_HEIGHT,
  CTA_HEIGHT,
  TNC_HEIGHT,
  QUANTITY_STICKER,
} from '@/constants/bannerTemplate'

interface BannerPreviewProps {
  state: BannerState
  isRemovingBg?: boolean
  enhanceJobStatus?: 'idle' | 'running' | 'done' | 'error'
  enhanceJobStep?: string
  onEnhance?: () => void
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
  ({ state, isRemovingBg = false, enhanceJobStatus = 'idle', enhanceJobStep = '', onEnhance }, ref) => {
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
      productImageSources,
      activeProductImageSourceId,
      logoImageSources,
      activeLogoImageSourceId,
      showOriginalLogo,
      logoScale,
      productImageScale,
      quantityStickerText,
      showQuantitySticker,
    } = state

    // Use the override if set, otherwise fall back to the catalogue name
    const displayName = productNameOverride ?? selectedProduct?.name

    // Use price override if set, otherwise fall back to catalogue prices
    const displayPrice = priceOverride ?? selectedProduct?.price

    // Derive effective product image from the active source
    const activeSource = productImageSources.find(s => s.id === activeProductImageSourceId)
    const effectiveImageUrl: string | undefined =
      activeSource
        ? activeSource.showOriginal
            ? activeSource.originalUrl
            : (activeSource.showBgRemoved && activeSource.bgRemovedUrl)
                ? activeSource.bgRemovedUrl
                : (activeSource.enhancedUrl ?? activeSource.originalUrl)
        : selectedProduct?.imageUrl
    const hasValidImage = (activeSource?.source === 'user' || activeSource?.source === 'ai')
      ? true
      : selectedProduct?.hasValidImage ?? false

    // Derive effective logo URL from the active logo source
    const activeLogoSource = logoImageSources.find(s => s.id === activeLogoImageSourceId)
    const brandLogo: string | null = activeLogoSource
      ? showOriginalLogo
          ? activeLogoSource.originalUrl
          : (activeLogoSource.showBgRemoved && activeLogoSource.bgRemovedUrl)
              ? activeLogoSource.bgRemovedUrl
              : (activeLogoSource.enhancedUrl ?? activeLogoSource.originalUrl)
      : brandLogoOverride ?? selectedProduct?.provider.brandLogo ?? null

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
        el.style.whiteSpace = 'pre-line'
        el.textContent = displayName

        const maxHeight = maxLines * size * lh
        if (el.scrollHeight <= maxHeight + 1) {
          setHeadingFontSize(size)
          // +4: Devanagari ink (matras, nuktas) visually overflows the CSS line box;
          // the extra pixels let that ink render instead of being clipped by overflow:hidden.
          setActualHeadingHeight(el.scrollHeight + 4)
          return
        }
      }
      setHeadingFontSize(minSize)
      setActualHeadingHeight(Math.min(el.scrollHeight, maxLines * minSize * lh) + 4)
    }, [displayName, headingConfig])

    // Use the actual measured height for layout, not the theoretical max
    const headingHeight = actualHeadingHeight

    // --- Adaptive font sizing + height measurement for subheading ---
    // Tries to fit on 1 line by shrinking from maxFontSize → minFontSize.
    // Falls back to 2 lines at minFontSize if the text is still too long.
    const subheadingMeasureRef = useRef<HTMLDivElement>(null)
    const [subheadingFontSize, setSubheadingFontSize] = useState(SUBHEADING_TEXT.maxFontSize)
    const [actualSubheadingHeight, setActualSubheadingHeight] = useState(SUBHEADING_TEXT_HEIGHT)

    useEffect(() => {
      const el = subheadingMeasureRef.current
      if (!el || !subheadingText) {
        setActualSubheadingHeight(SUBHEADING_TEXT_HEIGHT)
        setSubheadingFontSize(SUBHEADING_TEXT.maxFontSize)
        return
      }
      const { maxFontSize, minFontSize, fontSizeStep, fontWeight, fontFamily, lineHeight, maxLines } = SUBHEADING_TEXT
      el.style.fontWeight = String(fontWeight)
      el.style.fontFamily = fontFamily
      el.style.lineHeight = `${lineHeight}`
      el.style.width = `${SUBHEADING.maxWidth}px`
      el.style.wordBreak = 'break-word'
      el.style.whiteSpace = 'pre-line'
      el.textContent = subheadingText

      for (let size = maxFontSize; size >= minFontSize; size -= fontSizeStep) {
        el.style.fontSize = `${size}px`
        if (el.scrollHeight <= size * lineHeight + 1) {
          setSubheadingFontSize(size)
          setActualSubheadingHeight(el.scrollHeight + 4)
          return
        }
      }

      // Still wraps at minFontSize — allow up to maxLines at minFontSize
      el.style.fontSize = `${minFontSize}px`
      setSubheadingFontSize(minFontSize)
      setActualSubheadingHeight(Math.min(el.scrollHeight, maxLines * minFontSize * lineHeight) + 4)
    }, [subheadingText])

    // --- Determine which elements are visible and their heights ---
    const visibleElements = useMemo(() => {
      const elements: Array<{ id: ElementId; height: number }> = []

      if (showLogo && brandLogo) {
        elements.push({ id: 'logo', height: Math.round(BRAND_LOGO.height * logoScale) })
      }
      if (showHeading && displayName) {
        elements.push({ id: 'heading', height: headingHeight })
      }
      if (showSubheading && subheadingText) {
        elements.push({ id: 'subheading', height: actualSubheadingHeight })
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
    }, [showLogo, brandLogo, logoScale, showHeading, displayName, headingHeight, showSubheading, subheadingText, actualSubheadingHeight, showPrice, displayPrice, showCta, showTnc])

    // --- Compute dynamic vertical positions ---
    // CTA and T&C are bottom-anchored (computed from the bottom up) so they stay
    // fixed regardless of how tall the heading/subheading content grows.
    // All other elements (logo, heading, subheading, price) fill the space above.
    const positions = useMemo(() => {
      const posMap: Partial<Record<ElementId, number>> = {}
      if (visibleElements.length === 0) return posMap

      const topBound = LEFT_SECTION_TOP_PADDING
      const bottomBound = BANNER_HEIGHT - LEFT_SECTION_BOTTOM_PADDING

      // --- Step 1: Bottom-anchor CTA and T&C ---
      let topGroupBottomBound = bottomBound

      const tncEl = visibleElements.find(el => el.id === 'tnc')
      const ctaEl = visibleElements.find(el => el.id === 'cta')

      if (tncEl) {
        const tncTop = bottomBound - TNC_HEIGHT
        posMap['tnc'] = tncTop
        topGroupBottomBound = tncTop
      }

      if (ctaEl) {
        const ctaBottom = tncEl
          ? posMap['tnc']! - LEFT_SECTION_GAPS['cta-tnc']!
          : bottomBound
        const ctaTop = ctaBottom - CTA_HEIGHT
        posMap['cta'] = ctaTop
        topGroupBottomBound = ctaTop
      }

      // --- Step 2: Lay out remaining elements in the space above CTA ---
      const topElements = visibleElements.filter(el => el.id !== 'cta' && el.id !== 'tnc')
      if (topElements.length === 0) return posMap

      const lastTopEl = topElements[topElements.length - 1]!
      const anchorEl = ctaEl ?? tncEl
      const gapToAnchor = anchorEl ? getGapBetween(lastTopEl.id, anchorEl.id) : 0
      const topGroupMax = topGroupBottomBound - gapToAnchor
      const usableTopHeight = topGroupMax - topBound

      const topGaps: number[] = topElements.slice(0, -1).map((el, i) =>
        getGapBetween(el.id, topElements[i + 1]!.id),
      )
      const totalTopElementHeight = topElements.reduce((sum, el) => sum + el.height, 0)
      const totalTopGapHeight = topGaps.reduce((sum, g) => sum + g, 0)

      // Logo-first two-phase layout (logo absorbs scale growth upward)
      if (topElements[0]?.id === 'logo' && topElements.length > 1) {
        const scaledLogoHeight = topElements[0]!.height
        const logoRestGap = topGaps[0]!
        const restElements = topElements.slice(1)
        const restGaps = topGaps.slice(1)
        const restHeight = restElements.reduce((sum, el) => sum + el.height, 0)
        const restGapHeight = restGaps.reduce((sum, g) => sum + g, 0)

        const baseGroupHeight = BRAND_LOGO.height + logoRestGap + restHeight + restGapHeight
        const anchorGroupStart = topBound + Math.max(0, (usableTopHeight - baseGroupHeight) / 2)
        const headingAnchorTop = anchorGroupStart + BRAND_LOGO.height + logoRestGap

        const idealLogoTop = headingAnchorTop - logoRestGap - scaledLogoHeight
        const logoTop = Math.max(LOGO_MIN_TOP_PADDING, idealLogoTop)
        const firstRestTop = logoTop + scaledLogoHeight + logoRestGap

        posMap['logo'] = logoTop

        let scaledRestGaps = restGaps
        if (firstRestTop + restHeight + restGapHeight > topGroupMax && restGapHeight > 0) {
          const available = topGroupMax - firstRestTop
          const excess = restHeight + restGapHeight - available
          const gapScale = Math.max(0, (restGapHeight - excess) / restGapHeight)
          scaledRestGaps = restGaps.map(g => Math.round(g * gapScale))
        }

        let currentY = firstRestTop
        for (let i = 0; i < restElements.length; i++) {
          const el = restElements[i]!
          posMap[el.id] = currentY
          currentY += el.height
          if (i < scaledRestGaps.length) currentY += scaledRestGaps[i]!
        }

        return posMap
      }

      // Standard layout: vertically center top elements in the available space
      let scaledTopGaps = topGaps
      let totalTopHeight = totalTopElementHeight + totalTopGapHeight

      if (totalTopHeight > usableTopHeight && totalTopGapHeight > 0) {
        const excess = totalTopHeight - usableTopHeight
        const gapScale = Math.max(0, (totalTopGapHeight - excess) / totalTopGapHeight)
        scaledTopGaps = topGaps.map(g => Math.round(g * gapScale))
        totalTopHeight = totalTopElementHeight + scaledTopGaps.reduce((sum, g) => sum + g, 0)
      }

      let currentY = topBound + Math.max(0, (usableTopHeight - totalTopHeight) / 2)

      for (let i = 0; i < topElements.length; i++) {
        const el = topElements[i]!
        posMap[el.id] = currentY
        currentY += el.height
        if (i < scaledTopGaps.length) {
          currentY += scaledTopGaps[i]!
        }
      }

      return posMap
    }, [visibleElements])

    // CTA background colour comes from the selected background
    const ctaBgColor = selectedBackground?.ctaColor ?? CTA_BUTTON.defaultBg
    const ctaTextColor = selectedBackground?.ctaTextColor ?? CTA_BUTTON.color

    return (
      <>
      <div
        ref={ref}
        style={{
          width: BANNER_WIDTH,
          height: BANNER_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: BANNER_RADIUS,
          boxShadow: 'var(--shadow-deep)',
          fontFamily: PRODUCT_NAME.fontFamily,
          backgroundColor: BANNER_FALLBACK_BG,
        }}
      >
        {/* Hidden elements for measuring text — one per adaptive element */}
        <div
          ref={headingMeasureRef}
          style={{ position: 'absolute', visibility: 'hidden', top: -9999, left: -9999 }}
          aria-hidden="true"
        />
        <div
          ref={subheadingMeasureRef}
          style={{ position: 'absolute', visibility: 'hidden', top: -9999, left: -9999 }}
          aria-hidden="true"
        />

        {/* Background image (full bleed) */}
        {selectedBackground && (
          <img
            src={proxyUrl(selectedBackground.url)}
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
            src={proxyUrl(brandLogo)}
            alt={selectedProduct?.provider.brandName ?? ''}
            style={{
              position: 'absolute',
              left: BRAND_LOGO.x,
              top: positions.logo,
              width: BRAND_LOGO.width,
              height: BRAND_LOGO.height,
              objectFit: 'contain',
              objectPosition: 'left',
              // Scale from the left edge so the logo stays left-anchored
              transform: `scale(${logoScale})`,
              transformOrigin: 'left top',
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
              whiteSpace: 'pre-line',
            }}
          >
            {displayName}
          </div>
        )}

        {/* Subheading Text (independent element, shown when showSubheading is ON) */}
        {/* Supports up to SUBHEADING_TEXT.maxLines lines; height is measured and   */}
        {/* fed into the layout engine so all other elements reflow dynamically.     */}
        {showSubheading && subheadingText && positions.subheading !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: SUBHEADING.x,
              top: positions.subheading,
              width: SUBHEADING.maxWidth,
              height: actualSubheadingHeight,
              fontSize: subheadingFontSize,
              fontWeight: SUBHEADING_TEXT.fontWeight,
              color: SUBHEADING_TEXT.color,
              fontFamily: SUBHEADING_TEXT.fontFamily,
              lineHeight: SUBHEADING_TEXT.lineHeight,
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: SUBHEADING_TEXT.maxLines,
              WebkitBoxOrient: 'vertical',
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

        {/* Spinner overlay — covers right half while bg removal is in progress */}
        {isRemovingBg && (
          <>
            <style>{`@keyframes abr-spin{to{transform:rotate(360deg)}}`}</style>
            <div
              style={{
                position: 'absolute',
                left: IMAGE_LEFT_BARRIER,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: '3px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'abr-spin 0.8s linear infinite',
                }}
              />
            </div>
          </>
        )}

        {/* Enhance processing overlay — full banner, pointer-events-none */}
        {enhanceJobStatus === 'running' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
            {enhanceJobStep && (
              <span
                style={{
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '0 16px',
                  lineHeight: 1.4,
                }}
              >
                {enhanceJobStep}
              </span>
            )}
          </div>
        )}

        {/* Product Image (right half, bottom-aligned, centered at x=541.5) */}
        {hasValidImage && effectiveImageUrl && (
          <img
            src={proxyUrl(effectiveImageUrl)}
            alt={selectedProduct?.name ?? 'Product'}
            style={{
              position: 'absolute',
              bottom: PRODUCT_IMAGE.bottomOffset,
              // As zoom increases, shift the image center rightward so the left
              // edge never crosses IMAGE_LEFT_BARRIER (the 50/50 section split).
              // At scale s: left edge = centerX - width*s/2.
              // Clamp: centerX = max(nominal, barrier + width*s/2).
              left: Math.max(
                PRODUCT_IMAGE.centerX,
                IMAGE_LEFT_BARRIER + (PRODUCT_IMAGE.width * productImageScale) / 2,
              ),
              // translateX(-50%) centres the image on `left`; scale() zooms from that centre
              transform: `translateX(-50%) scale(${productImageScale})`,
              width: PRODUCT_IMAGE.width,
              height: PRODUCT_IMAGE.height,
              objectFit: 'contain',
            }}
          />
        )}

        {/* Quantity Sticker (pill, bottom-right of product image area) */}
        {showQuantitySticker && quantityStickerText && (
          <div
            style={{
              position: 'absolute',
              right: QUANTITY_STICKER.right,
              bottom: QUANTITY_STICKER.bottom,
              paddingLeft: QUANTITY_STICKER.paddingX,
              paddingRight: QUANTITY_STICKER.paddingX,
              paddingTop: QUANTITY_STICKER.paddingY,
              paddingBottom: QUANTITY_STICKER.paddingY,
              borderRadius: QUANTITY_STICKER.borderRadius,
              fontSize: QUANTITY_STICKER.fontSize,
              fontWeight: QUANTITY_STICKER.fontWeight,
              fontFamily: QUANTITY_STICKER.fontFamily,
              color: QUANTITY_STICKER.color,
              lineHeight: QUANTITY_STICKER.lineHeight,
              backgroundColor: ctaBgColor,
              whiteSpace: 'nowrap',
            }}
          >
            {quantityStickerText}
          </div>
        )}

      </div>

      {/* Enhance button — hidden once the pipeline completes successfully */}
      {enhanceJobStatus !== 'done' && (
        <div style={{ width: BANNER_WIDTH }}>
          <button
            onClick={onEnhance}
            disabled={enhanceJobStatus === 'running' || !onEnhance}
            className={[
              'w-full py-2 rounded-lg text-[12px] font-semibold transition-interaction active:scale-[0.98]',
              enhanceJobStatus === 'running' || !onEnhance
                ? 'bg-[var(--surface-2)] text-[var(--text-disabled)] cursor-not-allowed'
                : enhanceJobStatus === 'error'
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 cursor-pointer'
                : 'bg-[var(--accent-base)] text-white hover:bg-[var(--accent-hover)] cursor-pointer',
            ].join(' ')}
          >
            {enhanceJobStatus === 'running'
              ? (enhanceJobStep || 'Processing…')
              : enhanceJobStatus === 'error'
              ? 'Retry Enhance'
              : 'Enhance'}
          </button>
          {enhanceJobStatus === 'error' && (
            <p className="mt-1 text-[10px] text-red-400 text-center">
              Something went wrong. Click Retry Enhance to try again.
            </p>
          )}
        </div>
      )}
      </>
    )
  },
)

BannerPreview.displayName = 'BannerPreview'

export default BannerPreview 
