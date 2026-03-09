import { useState } from 'react'
import type { BackgroundOption, ProductPrice } from '@/types'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'
import BackgroundGallery from '@/components/BackgroundGallery/BackgroundGallery'
import ImageUploadZone from '@/components/ImageUploadZone/ImageUploadZone'

const CTA_PRESETS = ['SHOP NOW', 'BUY NOW', 'ORDER NOW']
const BADGE_PRESETS = ['Free Delivery', 'New Arrival', 'Limited Offer']

interface BannerControlsProps {
  ctaText: string
  badgeText: string
  showTnc: boolean
  showBadge: boolean
  tncText: string
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
  /** Current product image override (blob URL). null = catalogue image. */
  productImageOverride: string | null
  onProductImageChange: (url: string | null) => void
}

export default function BannerControls({
  ctaText,
  badgeText,
  showTnc,
  showBadge,
  tncText,
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
  productImageOverride,
  onProductImageChange,
}: BannerControlsProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)

  return (
    <div className="space-y-5 p-3">
      {/* Brand Logo — toggle + upload zone */}
      <Section title="Brand Logo">
        <TogglePill checked={showLogo} onToggle={onLogoToggle} />
        {showLogo && (
          <div className="mt-2">
            <ImageUploadZone
              currentImage={brandLogoOverride}
              onImageChange={onBrandLogoChange}
              label="Brand Logo"
            />
          </div>
        )}
      </Section>

      {/* Product Name — toggle + text override */}
      <Section title="Product Name">
        <TogglePill checked={showHeading} onToggle={onHeadingToggle} />
        {showHeading && (
          <div className="mt-2">
            <input
              type="text"
              value={productNameOverride ?? originalProductName ?? ''}
              onChange={(e) => {
                const value = e.target.value
                // Reset to null when the user types back the exact original name
                onProductNameChange(value === originalProductName ? null : value)
              }}
              className="input-base"
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
          <input
            type="text"
            value={subheadingText}
            onChange={(e) => onSubheadingTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            className="input-base mt-2"
            placeholder="Enter subheading..."
          />
        )}
      </Section>

      {/* Background Selector — inline 3-thumbnail strip */}
      <Section title="Background">
        <div className="flex gap-2">
          {BACKGROUND_OPTIONS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onBackgroundSelect(bg)}
              className={`flex-1 rounded-lg overflow-hidden aspect-[722/312] transition-interaction cursor-pointer ${
                selectedBackgroundId === bg.id
                  ? 'ring-2 ring-[var(--accent-base)] ring-offset-1 ring-offset-[var(--surface-1)]'
                  : 'ring-1 ring-[var(--border-muted)] hover:ring-[var(--border-focus)]'
              }`}
            >
              <img
                src={bg.url}
                alt="Background option"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => setGalleryOpen(true)}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-1.5 cursor-pointer transition-interaction"
        >
          Browse all...
        </button>
        <BackgroundGallery
          backgrounds={BACKGROUND_OPTIONS}
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

      {/* Product Image — upload zone */}
      <Section title="Product Image">
        <ImageUploadZone
          currentImage={productImageOverride}
          onImageChange={onProductImageChange}
          label="Product Image"
        />
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
