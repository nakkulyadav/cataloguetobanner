import { useState } from 'react'
import type { BackgroundOption } from '@/types'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'
import BackgroundGallery from '@/components/BackgroundGallery/BackgroundGallery'

const CTA_PRESETS = ['SHOP NOW', 'BUY NOW', 'ORDER NOW']
const BADGE_PRESETS = ['Free Delivery', 'New Arrival', 'Limited Offer']

interface BannerControlsProps {
  ctaText: string
  badgeText: string
  showTnc: boolean
  showBadge: boolean
  tncText: string
  selectedBackgroundId: string | null
  brandLogoOverride: string | null
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
  onBrandLogoOverride: (url: string | null) => void
  onProductNameChange: (name: string | null) => void
}

export default function BannerControls({
  ctaText,
  badgeText,
  showTnc,
  showBadge,
  tncText,
  selectedBackgroundId,
  brandLogoOverride,
  productNameOverride,
  originalProductName,
  onCtaChange,
  onBadgeChange,
  onTncToggle,
  onBadgeToggle,
  onTncTextChange,
  onBackgroundSelect,
  onBrandLogoOverride,
  onProductNameChange,
}: BannerControlsProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [logoInput, setLogoInput] = useState(brandLogoOverride ?? '')

  return (
    <div className="space-y-5 p-3">
      {/* Product Name Override */}
      <Section title="Product Name">
        <input
          type="text"
          value={productNameOverride ?? originalProductName ?? ''}
          onChange={(e) => {
            const value = e.target.value
            // Reset to null when the user types back the exact original name
            onProductNameChange(value === originalProductName ? null : value)
          }}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          placeholder="Product name..."
        />
        {productNameOverride !== null && (
          <button
            onClick={() => onProductNameChange(null)}
            className="text-xs text-red-400 hover:text-red-300 mt-1"
          >
            Reset to original
          </button>
        )}
      </Section>

      {/* Background Selector */}
      <Section title="Background">
        <button
          onClick={() => setGalleryOpen(true)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-500 transition-colors text-left"
        >
          {selectedBackgroundId
            ? `Background ${BACKGROUND_OPTIONS.findIndex((b) => b.id === selectedBackgroundId) + 1}`
            : 'Choose background...'}
        </button>
        <BackgroundGallery
          backgrounds={BACKGROUND_OPTIONS}
          selectedId={selectedBackgroundId}
          onSelect={onBackgroundSelect}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
        />
      </Section>

      {/* CTA Button Text */}
      <Section title="CTA Button">
        <input
          type="text"
          value={ctaText}
          onChange={(e) => onCtaChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          placeholder="Button text..."
        />
        <PresetChips
          presets={CTA_PRESETS}
          current={ctaText}
          onSelect={onCtaChange}
        />
      </Section>

      {/* Offer Badge */}
      <Section title="Offer Badge">
        <ToggleRow label={showBadge ? 'Visible' : 'Hidden'} checked={showBadge} onToggle={onBadgeToggle} />
        {showBadge && (
          <>
            <input
              type="text"
              value={badgeText}
              onChange={(e) => onBadgeChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 mt-2"
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
        <ToggleRow label={showTnc ? 'Visible' : 'Hidden'} checked={showTnc} onToggle={onTncToggle} />
        {showTnc && (
          <input
            type="text"
            value={tncText}
            onChange={(e) => onTncTextChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500 mt-2"
            placeholder="T&C text..."
          />
        )}
      </Section>

      {/* Brand Logo Override */}
      <Section title="Brand Logo Override">
        <div className="flex gap-2">
          <input
            type="text"
            value={logoInput}
            onChange={(e) => setLogoInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            placeholder="Paste logo URL..."
          />
          <button
            onClick={() => onBrandLogoOverride(logoInput.trim() || null)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors flex-shrink-0"
          >
            Apply
          </button>
        </div>
        {brandLogoOverride && (
          <button
            onClick={() => {
              onBrandLogoOverride(null)
              setLogoInput('')
            }}
            className="text-xs text-red-400 hover:text-red-300 mt-1"
          >
            Reset to default
          </button>
        )}
      </Section>
    </div>
  )
}

// --- Shared sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </label>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        onClick={onToggle}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
        />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
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
          className={`px-2 py-1 rounded text-xs transition-colors ${current === preset
            ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
            }`}
        >
          {preset}
        </button>
      ))}
    </div>
  )
}
