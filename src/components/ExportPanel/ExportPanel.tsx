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
      {/* FM-25: Accent-base button. FM-26: Disabled state uses surface-2 + border-subtle.
          FM-27: active:scale-[0.98] micro-interaction on enabled state. */}
      <button
        onClick={() => setModalOpen(true)}
        disabled={disabled || isExporting}
        className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-interaction cursor-pointer ${
          disabled || isExporting
            ? 'bg-[var(--surface-2)] text-[var(--text-disabled)] border border-[var(--border-subtle)] cursor-not-allowed'
            : 'bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-white active:scale-[0.98]'
        }`}
      >
        {isExporting ? 'Exporting...' : 'Export Banner'}
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
