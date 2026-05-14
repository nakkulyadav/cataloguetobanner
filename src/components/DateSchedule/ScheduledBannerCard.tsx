import { useRef, useState, useCallback } from 'react'
import BannerPreview from '@/components/BannerPreview/BannerPreview'
import ExportPanel from '@/components/ExportPanel/ExportPanel'
import { exportBanner, generateFilename } from '@/services/exportService'
import type { ExportFormat } from '@/services/exportService'
import type { BannerState, ScheduledBannerEntry } from '@/types'

interface ScheduledBannerCardProps {
  entry: ScheduledBannerEntry
  /** When true, renders a highlight ring indicating this card is being edited. */
  isEditing?: boolean
  /**
   * Live BannerState from the editing panel — overrides entry.bannerState for
   * the preview and export so edits are reflected in real time.
   */
  overrideBannerState?: BannerState | null
  /** Called when the user clicks the Edit button (only when isEditing is false). */
  onEdit?: () => void
  /**
   * Called when the user clicks the Save button (only when isEditing is true).
   * Signals the parent to commit the live BannerContext state back to this entry.
   */
  onSave?: () => void
  /** Called when the user clicks the Remove Bg button. */
  onRemoveBg?: () => void
  /** True while any bg removal is in progress (disables the button globally). */
  isRemovingBg?: boolean
  /** Called when the user clicks the Generate AI button. */
  onGenerateAiImages?: () => void
  /** True while AI image generation is in progress for this entry. */
  isGeneratingAiImages?: boolean
  /** Called when the user clicks the Reset entry button to clear persisted overrides. */
  onResetEntry?: () => void
  /** Called when the user clicks the Enhance button. Only rendered when provided. */
  onEnhance?: () => void
  /** Lifecycle of the enhance pipeline for this card. */
  enhanceJobStatus?: 'idle' | 'running' | 'done' | 'error'
  /** Current step label shown in the enhance overlay. */
  enhanceJobStep?: string
}

// ---------------------------------------------------------------------------
// Helper — compact bg-removal status badge shown in the action row
// ---------------------------------------------------------------------------

/**
 * Renders a small inline pill indicating the background-removal state for a
 * single card. Only shown when status is not 'idle' (i.e. something happened).
 */
function BgRemovalBadge({
  status,
  error,
}: {
  status: ScheduledBannerEntry['bgRemovalStatus']
  error: string | null
}) {
  if (status === 'idle') return null

  if (status === 'removing') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
        {/* Spinning indicator */}
        <span className="inline-block w-3 h-3 border border-[var(--accent-base)] border-t-transparent rounded-full animate-spin" />
        Removing bg…
      </span>
    )
  }

  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
        {/* Checkmark */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Bg removed
      </span>
    )
  }

  // error
  return (
    <span
      className="flex items-center gap-1 text-[11px] text-red-400 cursor-help"
      title={error ?? 'Background removal failed'}
    >
      {/* X mark */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Bg failed
    </span>
  )
}

function AiGenBadge({
  status,
  error,
}: {
  status: ScheduledBannerEntry['aiGenStatus']
  error: string | null
}) {
  if (status === 'idle') return null

  if (status === 'generating') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
        <span className="inline-block w-3 h-3 border border-[var(--accent-base)] border-t-transparent rounded-full animate-spin" />
        Generating…
      </span>
    )
  }

  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        AI done
      </span>
    )
  }

  // error
  return (
    <span
      className="flex items-center gap-1 text-[11px] text-red-400 cursor-help"
      title={error ?? 'AI image generation failed'}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      AI failed
    </span>
  )
}

/**
 * Renders a single scheduled banner card.
 *
 * Each card is self-contained:
 *  - Owns its own `bannerRef` for export capture.
 *  - Owns its own `isExporting` state.
 *  - Passes its own `onExport` handler to `ExportPanel` — scoping the export
 *    to this card's DOM node without modifying `ExportPanel`'s API.
 *
 * Renders three possible states driven by `entry.status`:
 *  - "loading" — skeleton placeholder at exact banner dimensions
 *  - "error"   — error message with the originating product URL
 *  - "ready"   — live BannerPreview + ExportPanel download button
 */
export default function ScheduledBannerCard({
  entry,
  isEditing = false,
  overrideBannerState = null,
  onEdit,
  onSave,
  onRemoveBg,
  isRemovingBg = false,
  onGenerateAiImages,
  isGeneratingAiImages = false,
  onResetEntry,
  onEnhance,
  enhanceJobStatus = 'idle',
  enhanceJobStep = '',
}: ScheduledBannerCardProps) {
  const bannerRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const productName = entry.bannerState?.selectedProduct?.name

  /**
   * Export handler scoped to this card's bannerRef.
   * Mirrors the handleExport pattern in App.tsx.
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!bannerRef.current) return
      setIsExporting(true)
      try {
        const filename = generateFilename(productName)
        await exportBanner(bannerRef.current, filename, format)
      } catch (err) {
        console.error('Scheduled banner export failed:', err)
      } finally {
        setIsExporting(false)
      }
    },
    [productName],
  )

  // --- Loading state ---
  if (entry.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3">
        {/* Skeleton at the same 712×322 aspect ratio, capped for display */}
        <div
          className="rounded-2xl bg-[var(--surface-2)] animate-pulse"
          style={{ width: 712, height: 322 }}
          aria-label="Loading banner..."
        />
        <p className="text-xs text-[var(--text-tertiary)] animate-pulse">Loading product…</p>
      </div>
    )
  }

  // --- Error state ---
  if (entry.status === 'error') {
    const productUrl = entry.sheetRow.productUrl
    return (
      <div
        className="rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-1)] flex flex-col items-center justify-center gap-2 p-6 text-center"
        style={{ width: 712, minHeight: 120 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-red-400 flex-shrink-0"
        >
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-red-400">{entry.error}</p>
        <p
          className="text-[10px] text-[var(--text-disabled)] max-w-md break-all leading-relaxed"
          title={productUrl}
        >
          {productUrl.slice(0, 120)}{productUrl.length > 120 ? '…' : ''}
        </p>
      </div>
    )
  }

  // --- Ready state ---
  if (!entry.bannerState) return null

  const displayState = overrideBannerState ?? entry.bannerState

  // Inject bg-removed logo URL when the toggle is on.
  // Product image bg-removal is handled inside BannerPreview via productImageSources.
  const effectiveDisplayState: typeof displayState =
    entry.showBgRemovedLogo && entry.bgRemovedLogoUrl
      ? { ...displayState, brandLogoOverride: entry.bgRemovedLogoUrl }
      : displayState

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Banner preview — highlight ring when editing, greyed out while bg is being removed */}
      <div
        className={`relative rounded-2xl overflow-hidden shadow-deep transition-all duration-500 ${entry.bgRemovalStatus === 'removing' ? 'grayscale opacity-50' : 'grayscale-0 opacity-100'
          }`}
        style={isEditing ? { outline: '2px solid var(--accent-base)', outlineOffset: 3 } : undefined}
      >
        {/* Pass enhanceJobStatus="done" to suppress BannerPreview's own Enhance button —
            the card manages its own button + overlay below. */}
        <BannerPreview ref={bannerRef} state={effectiveDisplayState} enhanceJobStatus="done" />
        {/* Enhance processing overlay */}
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
              borderRadius: 'inherit',
            }}
            aria-label="Enhancing…"
          >
            <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
            {enhanceJobStep && (
              <span style={{ color: 'white', fontSize: 13, fontWeight: 600, textAlign: 'center', padding: '0 16px', lineHeight: 1.4 }}>
                {enhanceJobStep}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Enhance button — only when onEnhance is wired; hidden once done */}
      {onEnhance && enhanceJobStatus !== 'done' && (
        <div style={{ width: 712 }}>
          <button
            type="button"
            onClick={onEnhance}
            disabled={enhanceJobStatus === 'running'}
            className={[
              'w-full py-2 rounded-lg text-[12px] font-semibold transition-interaction active:scale-[0.98]',
              enhanceJobStatus === 'running'
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

      {/* Product name label */}
      {productName && (
        <p className="text-xs text-[var(--text-tertiary)] max-w-[712px] truncate" title={productName}>
          {productName}
        </p>
      )}

      {/* Action row: Edit/Save + Export + bg-removal status badge */}
      <div className="flex items-center gap-2">
        {/*
         * When isEditing is true, the button becomes "Save" and calls onSave
         * to commit the live BannerContext state back to this entry (ES-5).
         * When isEditing is false, it shows "Edit" and calls onEdit as before.
         * The active accent style is kept in both editing and saving states so
         * the card remains visually highlighted throughout the edit session.
         */}
        {(onEdit || onSave) && (
          <button
            type="button"
            onClick={isEditing ? onSave : onEdit}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-interaction cursor-pointer ${isEditing
                ? 'bg-[var(--accent-base)] text-white'
                : 'border border-[var(--border-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
              }`}
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
        )}
        {onRemoveBg && entry.bgRemovalStatus === 'error' && (
          <button
            type="button"
            onClick={onRemoveBg}
            disabled={isRemovingBg}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-interaction border border-[var(--border-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Retry Bg
          </button>
        )}
        {onGenerateAiImages && (
          <button
            type="button"
            onClick={onGenerateAiImages}
            disabled={isGeneratingAiImages || entry.aiGenStatus === 'generating'}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-interaction border border-[var(--border-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Generate AI
          </button>
        )}
        <ExportPanel
          onExport={handleExport}
          isExporting={isExporting}
          disabled={false}
        />
        {/* Per-card status badges — only shown when active */}
        <BgRemovalBadge
          status={entry.bgRemovalStatus}
          error={entry.bgRemovalError}
        />
        <AiGenBadge
          status={entry.aiGenStatus}
          error={entry.aiGenError}
        />
        {onResetEntry && (
          <button
            type="button"
            onClick={onResetEntry}
            title="Clear bg-removed and AI-generated overrides for this entry"
            className="ml-1 p-1.5 rounded text-[var(--text-disabled)] hover:text-red-400 transition-interaction cursor-pointer"
            aria-label="Reset entry"
          >
            {/* Rotate-left (reset) icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 7a4.5 4.5 0 1 1 .9 2.7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2.5 4.5V7H5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
