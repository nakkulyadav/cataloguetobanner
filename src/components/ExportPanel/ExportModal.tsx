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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Export Banner</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none"
          >
            &times;
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
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                canExport
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isExporting ? 'Exporting...' : opt.label}
            </button>
          ))}

          {/* Export to CMS — placeholder */}
          <button
            disabled
            className="px-4 py-3 rounded-lg text-sm font-semibold bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
            title="Coming soon"
          >
            Export to CMS
            <span className="block text-xs font-normal text-gray-600 mt-1">Coming soon</span>
          </button>
        </div>
      </div>
    </div>
  )
}
