import type { ExportFormat } from '@/services/exportService'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (format: ExportFormat) => void
  isExporting: boolean
  disabled: boolean
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
]

/* FM-39: ExportModal follows the same modal conventions as BackgroundGallery —
   backdrop-blur, surface-1 bg, border-muted, dialog-enter animation, SVG close button. */
export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
  disabled,
}: ExportModalProps) {
  if (!isOpen) return null

  const canExport = !disabled && !isExporting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Export Banner</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--surface-2)] transition-interaction cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--text-tertiary)]">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Format buttons (2×2 grid) */}
        <div className="grid grid-cols-2 gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onExport(opt.value)
                onClose()
              }}
              disabled={!canExport}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-interaction cursor-pointer ${
                canExport
                  ? 'bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-white active:scale-[0.98]'
                  : 'bg-[var(--surface-2)] text-[var(--text-disabled)] cursor-not-allowed'
              }`}
            >
              {isExporting ? 'Exporting...' : opt.label}
            </button>
          ))}

          {/* Export to CMS — placeholder */}
          <button
            disabled
            className="px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--surface-2)] text-[var(--text-disabled)] cursor-not-allowed border border-[var(--border-subtle)]"
          >
            Export to CMS
            <span className="block text-xs font-normal text-[var(--text-tertiary)] mt-1">Coming soon</span>
          </button>
        </div>
      </div>
    </div>
  )
}
