import type { ImageSource } from '@/types'
import BgVersionPill from '@/components/BgVersionPill/BgVersionPill'

interface ImageSourceListProps {
  sources: ImageSource[]
  activeSourceId: string | null
  onSelect: (id: string) => void
  /** Called only for 'user' sources */
  onRemove: (id: string) => void
  onToggleBgRemoved: (id: string) => void
}

/**
 * Horizontal thumbnail strip of available product image sources.
 * Each chip shows the source image, a status indicator, and (for user sources)
 * a remove button. A BgVersionPill appears below the strip when the active
 * source has finished background removal.
 */
export default function ImageSourceList({
  sources,
  activeSourceId,
  onSelect,
  onRemove,
  onToggleBgRemoved,
}: ImageSourceListProps) {
  const activeSource = sources.find(s => s.id === activeSourceId)

  return (
    <div className="space-y-2">
      {/* Thumbnail strip */}
      <div className="flex flex-wrap gap-2">
        {sources.map(source => (
          <Chip
            key={source.id}
            source={source}
            isActive={source.id === activeSourceId}
            onSelect={() => onSelect(source.id)}
            onRemove={() => onRemove(source.id)}
          />
        ))}
      </div>

      {/* Per-source BgVersionPill — only when active source has a bg-removed version */}
      {activeSource?.bgRemovalStatus === 'done' && (
        <BgVersionPill
          showBgRemoved={activeSource.showBgRemoved}
          onToggle={() => onToggleBgRemoved(activeSource.id)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

function Chip({
  source,
  isActive,
  onSelect,
  onRemove,
}: {
  source: ImageSource
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex-shrink-0 cursor-pointer"
      style={{ width: 40, height: 40 }}
      aria-label={source.label}
      title={source.label}
    >
      {/* Thumbnail image */}
      <img
        src={source.originalUrl}
        alt={source.label}
        style={{
          width: 40,
          height: 40,
          objectFit: 'cover',
          borderRadius: 6,
          filter: source.bgRemovalStatus === 'removing' ? 'grayscale(1)' : 'none',
          transition: 'filter 0.2s',
          display: 'block',
        }}
      />

      {/* Active outline */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 8,
            border: '2px solid var(--accent-base)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Status indicator — bottom-right corner */}
      <StatusIndicator status={source.bgRemovalStatus} />

      {/* Remove button — top-right corner, only for user sources */}
      {source.source === 'user' && (
        <RemoveButton onRemove={(e) => { e.stopPropagation(); onRemove() }} />
      )}
    </button>
  )
}

function StatusIndicator({ status }: { status: ImageSource['bgRemovalStatus'] }) {
  if (status === 'idle') return null

  if (status === 'removing') {
    return (
      <>
        <style>{`@keyframes isl-spin{to{transform:rotate(360deg)}}`}</style>
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '1.5px solid white',
            borderTopColor: 'transparent',
            animation: 'isl-spin 0.8s linear infinite',
          }}
        />
      </>
    )
  }

  if (status === 'done') {
    return (
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: 'var(--accent-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          color: 'white',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ✓
      </span>
    )
  }

  // error
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        color: 'white',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      !
    </span>
  )
}

function RemoveButton({ onRemove }: { onRemove: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove image"
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        width: 14,
        height: 14,
        borderRadius: '50%',
        backgroundColor: 'var(--surface-3)',
        border: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: 9,
        color: 'var(--text-secondary)',
        lineHeight: 1,
        padding: 0,
      }}
    >
      ×
    </button>
  )
}
