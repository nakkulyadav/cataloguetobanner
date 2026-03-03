import type { BackgroundOption } from '@/types'

interface BackgroundGalleryProps {
  backgrounds: BackgroundOption[]
  selectedId: string | null
  onSelect: (bg: BackgroundOption) => void
  isOpen: boolean
  onClose: () => void
}

/* FM-32: dialog-enter animation (defined in index.css).
   FM-33: backdrop-blur-sm on overlay.
   FM-34: surface-1 bg, border-muted, shadow-xl.
   FM-35: SVG close button, w-7 h-7 rounded-md hover:surface-2.
   FM-36: ring-2 accent selection vs ring-1 border-muted unselected. */
export default function BackgroundGallery({
  backgrounds,
  selectedId,
  onSelect,
  isOpen,
  onClose,
}: BackgroundGalleryProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Choose Background</h3>
          {/* FM-35: SVG close button */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--surface-2)] transition-interaction cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--text-tertiary)]">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* FM-36: Thumbnail selection — accent ring for selected, muted ring for unselected */}
        <div className="grid grid-cols-3 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                onSelect(bg)
                onClose()
              }}
              className={`relative rounded-lg overflow-hidden aspect-[722/312] transition-interaction cursor-pointer ${
                selectedId === bg.id
                  ? 'ring-2 ring-[var(--accent-base)] ring-offset-2 ring-offset-[var(--surface-1)]'
                  : 'ring-1 ring-[var(--border-muted)] hover:ring-[var(--text-tertiary)]'
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
      </div>
    </div>
  )
}
