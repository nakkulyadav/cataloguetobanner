import ScheduledBannerCard from './ScheduledBannerCard'
import type { BannerState, ScheduledBannerEntry } from '@/types'

interface ScheduledBannersGridProps {
  /** The YYYY-MM-DD date string currently selected by the user */
  selectedDate: string
  /** True while the Google Sheet is being fetched */
  isFetching: boolean
  /** Sheet-level error (network failure or no rows matched) */
  fetchError: string | null
  /** Banner entries for the selected date — may mix loading/ready/error states */
  entries: ScheduledBannerEntry[]
  /** ID of the entry currently open in the editing panel, if any */
  editingId: string | null
  /** Called when the user clicks Edit on a card */
  onEditEntry: (entry: ScheduledBannerEntry) => void
  /**
   * Called when the user clicks Save on the card that is currently being
   * edited. Receives the entry id so the caller can commit the live
   * BannerContext state back to that specific entry (ES-4).
   */
  onSaveEntry?: (id: string) => void
  /** Live BannerState from useBannerState — passed as override to the editing card */
  editingBannerState: BannerState | null
  /** Called when the user clicks Remove Bg on a card */
  onRemoveBgEntry: (id: string) => void
  /** True while any bg removal is in progress */
  isRemovingBg: boolean
}

/**
 * Top-level view for the Scheduled Banners feature.
 *
 * Layout:
 *   - Header with a date picker and a status summary
 *   - Scrollable area with one `ScheduledBannerCard` per matched sheet row
 *   - Empty / loading / error states when no banners are available
 */
export default function ScheduledBannersGrid({
  selectedDate,
  isFetching,
  fetchError,
  entries,
  editingId,
  onEditEntry,
  onSaveEntry,
  editingBannerState,
  onRemoveBgEntry,
  isRemovingBg,
}: ScheduledBannersGridProps) {
  return (
    <div className="flex flex-col h-full">
      {/* ------------------------------------------------------------------ */}
      {/* Header — title + entry count                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
            Scheduled Banners
          </h2>

          {entries.length > 0 && !isFetching && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {entries.length} banner{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* No date selected yet */}
        {!selectedDate && (
          <EmptyState message="Pick a date to load that day's scheduled banners." />
        )}

        {/* Sheet fetch in progress */}
        {selectedDate && isFetching && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-6 h-6 border-2 border-[var(--accent-base)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-tertiary)]">Loading promotions sheet…</p>
          </div>
        )}

        {/* Sheet-level error (fetch failed or no rows matched) */}
        {fetchError && !isFetching && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-red-400"
            >
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-[var(--text-secondary)]">{fetchError}</p>
          </div>
        )}

        {/* Banner cards — stream in as each product lookup resolves */}
        {entries.length > 0 && !isFetching && (
          <div className="flex flex-col items-center gap-10">
            {entries.map(entry => (
              <ScheduledBannerCard
                key={entry.id}
                entry={entry}
                isEditing={entry.id === editingId}
                overrideBannerState={entry.id === editingId ? editingBannerState : null}
                onEdit={entry.status === 'ready' ? () => onEditEntry(entry) : undefined}
                onSave={onSaveEntry ? () => onSaveEntry(entry.id) : undefined}
                onRemoveBg={entry.status === 'ready' ? () => onRemoveBgEntry(entry.id) : undefined}
                isRemovingBg={isRemovingBg}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper — generic empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {/* Calendar icon */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        className="text-[var(--text-disabled)] opacity-50"
      >
        <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 18h36" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="14" y="24" width="6" height="5" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="28" y="24" width="6" height="5" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="14" y="32" width="6" height="5" rx="1" fill="currentColor" opacity="0.2" />
      </svg>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs">{message}</p>
    </div>
  )
}
