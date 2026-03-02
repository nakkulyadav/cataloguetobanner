import { useState } from 'react'
import type { ExportFormat } from '@/services/exportService'
import ExportModal from './ExportModal'

interface ExportPanelProps {
  onExport: (format: ExportFormat) => void
  isExporting: boolean
  disabled: boolean
}

export default function ExportPanel({ onExport, isExporting, disabled }: ExportPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="p-3">
      <button
        onClick={() => setModalOpen(true)}
        disabled={disabled || isExporting}
        className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
          disabled || isExporting
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isExporting ? 'Exporting...' : 'Download Banner'}
      </button>

      <ExportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onExport={onExport}
        isExporting={isExporting}
        disabled={disabled}
      />
    </div>
  )
}
