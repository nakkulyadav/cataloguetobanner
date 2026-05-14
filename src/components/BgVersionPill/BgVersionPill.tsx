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
  labelA = 'Original',
  labelB = 'BG Removed',
}: {
  /** Whether the second (right) segment is currently active */
  showBgRemoved: boolean
  /** Called when either segment is clicked */
  onToggle: () => void
  /** Label for the left (first) segment. Defaults to "Original". */
  labelA?: string
  /** Label for the right (second) segment. Defaults to "BG Removed". */
  labelB?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showBgRemoved}
      onClick={onToggle}
      className="relative flex h-7 w-full rounded-md bg-[var(--surface-2)] border border-[var(--border-muted)] cursor-pointer overflow-hidden transition-interaction"
    >
      {/* Sliding highlight — left = labelA, right = labelB */}
      <span
        className="absolute top-0.5 bottom-0.5 w-1/2 rounded-[5px] transition-all duration-150 ease-[var(--ease-standard)]"
        style={{
          left: showBgRemoved ? 'calc(50% - 2px)' : '2px',
          backgroundColor: 'var(--accent-base)',
        }}
      />
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          !showBgRemoved ? 'text-white' : 'text-[var(--text-tertiary)]'
        }`}
      >
        {labelA}
      </span>
      <span
        className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-semibold transition-colors duration-150 ${
          showBgRemoved ? 'text-white' : 'text-[var(--text-tertiary)]'
        }`}
      >
        {labelB}
      </span>
    </button>
  )
}
