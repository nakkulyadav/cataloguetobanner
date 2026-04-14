import { useState } from 'react'
import type { BackgroundOption, ProductPrice, ImageSource } from '@/types'
import BackgroundGallery from '@/components/BackgroundGallery/BackgroundGallery'
import ImageUploadZone from '@/components/ImageUploadZone/ImageUploadZone'
import BgVersionPill from '@/components/BgVersionPill/BgVersionPill'
import ImageSourceList from '@/components/ImageSourceList/ImageSourceList'
import { SUPPORTED_LANGUAGES } from '@/services/translationService'
import type { LanguageCode } from '@/services/translationService'

const CTA_PRESETS = ['SHOP NOW', 'BUY NOW', 'ORDER NOW']
const BADGE_PRESETS = ['Free Delivery', 'New Arrival', 'Limited Offer']

interface BannerControlsProps {
  ctaText: string
  badgeText: string
  showTnc: boolean
  showBadge: boolean
  tncText: string
  /** All available backgrounds fetched from the sheet (or static fallback). */
  backgrounds: BackgroundOption[]
  selectedBackgroundId: string | null
  /** Current product name override (null = using original catalogue name) */
  productNameOverride: string | null
  /** Original product name from the catalogue (null = no product selected) */
  originalProductName: string | null
  onCtaChange: (text: string) => void
  onBadgeChange: (text: string) => void
  onTncToggle: () => void
  onBadgeToggle: () => void
  onTncTextChange: (text: string) => void
  onBackgroundSelect: (bg: BackgroundOption) => void
  onProductNameChange: (name: string | null) => void
  showPrice: boolean
  onPriceToggle: () => void
  /** Current price override (null = using original catalogue prices) */
  priceOverride: ProductPrice | null
  /** Original prices from catalogue (undefined = no price data) */
  originalPrice: ProductPrice | undefined
  onPriceOverrideChange: (price: ProductPrice | null) => void
  /** Custom subheading text (independent element, shown when showSubheading is ON) */
  subheadingText: string
  onSubheadingTextChange: (text: string) => void
  /** Toggle visibility of the subheading element (activates compact heading mode) */
  showSubheading: boolean
  onSubheadingToggle: () => void
  // --- Toggleable element props ---
  showLogo: boolean
  onLogoToggle: () => void
  showHeading: boolean
  onHeadingToggle: () => void
  showCta: boolean
  onCtaToggle: () => void
  /** Current brand logo override (blob or remote URL). null = catalogue logo. */
  brandLogoOverride: string | null
  onBrandLogoChange: (url: string | null) => void
  /** Zoom scale for the brand logo (1 = 100%). Range [0.5, 2.0]. */
  logoScale: number
  onLogoScaleChange: (scale: number) => void
  /** Zoom scale for the product image (1 = 100%). Range [0.5, 2.0]. */
  productImageScale: number
  onProductImageScaleChange: (scale: number) => void
  // --- ISL: source list props ---
  productImageSources: ImageSource[]
  activeProductImageSourceId: string | null
  /** Called with the blob URL when the user uploads or pastes a new image */
  onAddProductImage: (url: string) => void
  onRemoveProductImageSource: (id: string) => void
  onSelectProductImageSource: (id: string) => void
  onToggleSourceBgRemoved: (id: string) => void
  showQuantitySticker: boolean
  onQuantityStickerToggle: () => void
  quantityStickerText: string | null
  onQuantityStickerTextChange: (text: string | null) => void
  /**
   * True once a background-removed brand logo blob URL is available.
   * When true, a version pill is shown beneath the Brand Logo upload zone.
   */
  hasBgRemovedLogo: boolean
  /** Whether the bg-removed logo version is currently displayed */
  showBgRemovedLogo: boolean
  /** Called when the user clicks either segment of the logo version pill */
  onToggleBgRemovedLogo: () => void
  onTranslateAll: (langCode: LanguageCode) => Promise<void>
  isTranslating: boolean
}

export default function BannerControls({
  ctaText,
  badgeText,
  showTnc,
  showBadge,
  tncText,
  backgrounds,
  selectedBackgroundId,
  productNameOverride,
  originalProductName,
  onCtaChange,
  onBadgeChange,
  onTncToggle,
  onBadgeToggle,
  onTncTextChange,
  onBackgroundSelect,
  onProductNameChange,
  showPrice,
  onPriceToggle,
  priceOverride,
  originalPrice,
  onPriceOverrideChange,
  subheadingText,
  onSubheadingTextChange,
  showSubheading,
  onSubheadingToggle,
  showLogo,
  onLogoToggle,
  showHeading,
  onHeadingToggle,
  showCta,
  onCtaToggle,
  brandLogoOverride,
  onBrandLogoChange,
  logoScale,
  onLogoScaleChange,
  productImageScale,
  onProductImageScaleChange,
  productImageSources,
  activeProductImageSourceId,
  onAddProductImage,
  onRemoveProductImageSource,
  onSelectProductImageSource,
  onToggleSourceBgRemoved,
  showQuantitySticker,
  onQuantityStickerToggle,
  quantityStickerText,
  onQuantityStickerTextChange,
  hasBgRemovedLogo,
  showBgRemovedLogo,
  onToggleBgRemovedLogo,
  onTranslateAll,
  isTranslating,
}: BannerControlsProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('hi')

  return (
    <div className="space-y-5 p-3">
      {/* Translation */}
      <Section title="Translate">
        <div className="flex gap-2 mt-1">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value as LanguageCode)}
            disabled={isTranslating}
            className="flex-1 input-base text-xs py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <button
            onClick={() => void onTranslateAll(selectedLang)}
            disabled={isTranslating}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent-base)] text-white hover:opacity-90 transition-interaction cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isTranslating ? 'Translating...' : 'Translate All'}
          </button>
        </div>
      </Section>

      {/* Brand Logo — toggle + upload zone + zoom slider + bg-version pill (IT-12) */}
      <Section title="Brand Logo">
        <TogglePill checked={showLogo} onToggle={onLogoToggle} />
        {showLogo && (
          <div className="mt-2 space-y-2">
            <ImageUploadZone
              currentImage={brandLogoOverride}
              onImageChange={onBrandLogoChange}
              label="Brand Logo"
            />
            <ZoomSlider
              scale={logoScale}
              onChange={onLogoScaleChange}
              onReset={() => onLogoScaleChange(1)}
            />
            {/* IT-12: show version toggle only when a bg-removed blob is ready */}
            {hasBgRemovedLogo && (
              <BgVersionPill
                showBgRemoved={showBgRemovedLogo}
                onToggle={onToggleBgRemovedLogo}
              />
            )}
          </div>
        )}
      </Section>

      {/* Product Name — toggle + text override */}
      <Section title="Product Name">
        <TogglePill checked={showHeading} onToggle={onHeadingToggle} />
        {showHeading && (
          <div className="mt-2">
            <textarea
              rows={2}
              value={productNameOverride ?? originalProductName ?? ''}
              onChange={(e) => {
                const value = e.target.value
                // Reset to null when the user types back the exact original name
                onProductNameChange(value === originalProductName ? null : value)
              }}
              className="input-base resize-none"
              placeholder="Product name..."
            />
            {productNameOverride !== null && (
              <button
                onClick={() => onProductNameChange(null)}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-1 cursor-pointer transition-interaction"
              >
                Reset to original
              </button>
            )}
          </div>
        )}
      </Section>

      {/* Subheading — toggle + text input (activates compact heading mode) */}
      <Section title="Subheading">
        <TogglePill checked={showSubheading} onToggle={onSubheadingToggle} />
        {showSubheading && (
          <textarea
            rows={2}
            value={subheadingText}
            onChange={(e) => onSubheadingTextChange(e.target.value)}
            className="input-base resize-none mt-2"
            placeholder="Enter subheading..."
          />
        )}
      </Section>

      {/* Background Selector — button opens gallery popover */}
      <Section title="Background">
        {(() => {
          const selectedBg = backgrounds.find(b => b.id === selectedBackgroundId) ?? null
          return (
            <button
              onClick={() => setGalleryOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] hover:border-[var(--border-focus)] transition-interaction cursor-pointer text-left"
            >
              {selectedBg ? (
                <img
                  src={selectedBg.url}
                  alt={selectedBg.name}
                  className="h-8 w-14 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-8 w-14 rounded bg-[var(--surface-3)] flex-shrink-0" />
              )}
              <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                {selectedBg ? selectedBg.name : 'Select background...'}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--text-tertiary)] flex-shrink-0">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )
        })()}
        <BackgroundGallery
          backgrounds={backgrounds}
          selectedId={selectedBackgroundId}
          onSelect={onBackgroundSelect}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
        />
      </Section>

      {/* CTA Button — toggle + text + presets */}
      <Section title="CTA Button">
        <TogglePill checked={showCta} onToggle={onCtaToggle} />
        {showCta && (
          <div className="mt-2">
            <input
              type="text"
              value={ctaText}
              onChange={(e) => onCtaChange(e.target.value)}
              className="input-base"
              placeholder="Button text..."
            />
            <PresetChips
              presets={CTA_PRESETS}
              current={ctaText}
              onSelect={onCtaChange}
            />
          </div>
        )}
      </Section>

      {/* Offer Badge */}
      <Section title="Offer Badge">
        <TogglePill checked={showBadge} onToggle={onBadgeToggle} />
        {showBadge && (
          <>
            <input
              type="text"
              value={badgeText}
              onChange={(e) => onBadgeChange(e.target.value)}
              className="input-base mt-2"
              placeholder="Badge text..."
            />
            <PresetChips
              presets={BADGE_PRESETS}
              current={badgeText}
              onSelect={onBadgeChange}
            />
          </>
        )}
      </Section>

      {/* T&C Text */}
      <Section title="*T&C Apply">
        <TogglePill checked={showTnc} onToggle={onTncToggle} />
        {showTnc && (
          <input
            type="text"
            value={tncText}
            onChange={(e) => onTncTextChange(e.target.value)}
            className="input-base mt-2"
            placeholder="T&C text..."
          />
        )}
      </Section>

      {/* Price Display */}
      <Section title="Price">
        <TogglePill checked={showPrice} onToggle={onPriceToggle} />
        {showPrice && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">MRP</label>
              <input
                type="text"
                value={priceOverride?.mrp ?? originalPrice?.mrp ?? ''}
                onChange={(e) => {
                  const currentSelling = priceOverride?.sellingPrice ?? originalPrice?.sellingPrice ?? ''
                  const newMrp = e.target.value
                  // Reset to null if both match originals
                  if (newMrp === originalPrice?.mrp && currentSelling === originalPrice?.sellingPrice) {
                    onPriceOverrideChange(null)
                  } else {
                    onPriceOverrideChange({ mrp: newMrp, sellingPrice: currentSelling })
                  }
                }}
                className="input-base"
                placeholder="e.g. ₹1,299"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">Selling Price</label>
              <input
                type="text"
                value={priceOverride?.sellingPrice ?? originalPrice?.sellingPrice ?? ''}
                onChange={(e) => {
                  const currentMrp = priceOverride?.mrp ?? originalPrice?.mrp ?? ''
                  const newSelling = e.target.value
                  if (currentMrp === originalPrice?.mrp && newSelling === originalPrice?.sellingPrice) {
                    onPriceOverrideChange(null)
                  } else {
                    onPriceOverrideChange({ mrp: currentMrp, sellingPrice: newSelling })
                  }
                }}
                className="input-base"
                placeholder="e.g. ₹499"
              />
            </div>
            {priceOverride !== null && (
              <button
                onClick={() => onPriceOverrideChange(null)}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-interaction"
              >
                Reset to original
              </button>
            )}
          </div>
        )}
      </Section>

      {/* Product Image — source list + add via upload + zoom slider */}
      <Section title="Product Image">
        <div className="space-y-2">
          {productImageSources.length > 0 && (
            <ImageSourceList
              sources={productImageSources}
              activeSourceId={activeProductImageSourceId}
              onSelect={onSelectProductImageSource}
              onRemove={onRemoveProductImageSource}
              onToggleBgRemoved={onToggleSourceBgRemoved}
            />
          )}
          <ImageUploadZone
            currentImage={null}
            onImageChange={url => { if (url) onAddProductImage(url) }}
            label="Add Image"
          />
          <ZoomSlider
            scale={productImageScale}
            onChange={onProductImageScaleChange}
            onReset={() => onProductImageScaleChange(1)}
          />
        </div>
      </Section>

      {/* Quantity Sticker — toggle + editable text */}
      <Section title="Quantity Sticker">
        <TogglePill checked={showQuantitySticker} onToggle={onQuantityStickerToggle} />
        {showQuantitySticker && (
          <input
            type="text"
            value={quantityStickerText ?? ''}
            onChange={(e) => onQuantityStickerTextChange(e.target.value || null)}
            className="input-base mt-2"
            placeholder="e.g. PACK OF 5"
          />
        )}
      </Section>

    </div>
  )
}

// --- Shared sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-2">
        {title}
      </label>
      {children}
    </div>
  )
}

/**
 * Modern segmented pill toggle — two labeled segments ("On" / "Off")
 * with a sliding highlight indicator behind the active option.
 */
function TogglePill({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="relative flex h-7 w-[88px] rounded-md bg-[var(--surface-2)] border border-[var(--border-muted)] cursor-pointer overflow-hidden transition-interaction"
    >
      {/* Sliding highlight */}
      <span
        className="absolute top-0.5 bottom-0.5 w-[42px] rounded-[5px] transition-all duration-150 ease-[var(--ease-standard)]"
        style={{
          left: checked ? '2px' : 'calc(100% - 44px)',
          backgroundColor: checked ? 'var(--accent-base)' : 'var(--surface-3)',
        }}
      />
      {/* "On" label — left segment */}
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          checked ? 'text-white' : 'text-[var(--text-tertiary)]'
        }`}
      >
        On
      </span>
      {/* "Off" label — right segment */}
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          !checked ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
        }`}
      >
        Off
      </span>
    </button>
  )
}

/**
 * Zoom slider shown beneath each image field.
 * Range: 50%–200% in 5% steps. Shows current percentage and a reset button
 * when the scale has been changed from the default (1.0).
 */
function ZoomSlider({
  scale,
  onChange,
  onReset,
}: {
  scale: number
  onChange: (value: number) => void
  onReset: () => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-tertiary)]">Zoom</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {Math.round(scale * 100)}%
          </span>
          {scale !== 1 && (
            <button
              onClick={onReset}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-interaction"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0.5}
        max={2}
        step={0.05}
        value={scale}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 cursor-pointer accent-[var(--accent-base)]"
      />
    </div>
  )
}


function PresetChips({
  presets,
  current,
  onSelect,
}: {
  presets: string[]
  current: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {presets.map((preset) => (
        <button
          key={preset}
          onClick={() => onSelect(preset)}
          className={`px-2 py-1 rounded text-xs transition-interaction cursor-pointer ${
            current === preset
              ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--accent-base)]'
              : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-muted)] hover:border-[var(--text-tertiary)]'
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  )
}
