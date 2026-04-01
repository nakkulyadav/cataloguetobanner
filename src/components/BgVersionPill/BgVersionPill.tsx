/**
 * Two-segment segmented pill for switching between the original image and
 * the background-removed version.
 *
 * Used in both builder mode (BannerControls) and scheduled mode
 * (ScheduledBannerCard in edit mode).
 */
export default function BgVersionPill({
  showBgRemoved,
  onToggle,
}: {
  /** Whether the BG-removed version is currently active */
  showBgRemoved: boolean
  /** Called when either segment is clicked */
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showBgRemoved}
      onClick={onToggle}
      className="relative flex h-7 w-full rounded-md bg-[var(--surface-2)] border border-[var(--border-muted)] cursor-pointer overflow-hidden transition-interaction"
    >
      {/* Sliding highlight — left = Original, right = BG Removed */}
      <span
        className="absolute top-0.5 bottom-0.5 w-1/2 rounded-[5px] transition-all duration-150 ease-[var(--ease-standard)]"
        style={{
          left: showBgRemoved ? 'calc(50% - 2px)' : '2px',
          backgroundColor: 'var(--accent-base)',
        }}
      />
      {/* "Original" segment */}
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          !showBgRemoved ? 'text-white' : 'text-[var(--text-tertiary)]'
        }`}
      >
        Original
      </span>
      {/* "BG Removed" segment */}
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          showBgRemoved ? 'text-white' : 'text-[var(--text-tertiary)]'
        }`}
      >
        BG Removed
      </span>
    </button>
  )
}
