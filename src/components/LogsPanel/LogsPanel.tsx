import type { LogEntry } from '@/types'

interface LogsPanelProps {
  logs: LogEntry[]
  onClear: () => void
}

/* FM-28: Proper inline SVG icons for each log level.
   FM-29: Status token colors for icon + background. */
const LEVEL_CONFIG = {
  info: {
    color: 'var(--status-info)',
    bg: 'var(--status-info-bg)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 5.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6" cy="3.75" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  warning: {
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-bg)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1L11.5 10.5H0.5L6 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M6 5V7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="6" cy="9" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  error: {
    color: 'var(--status-error)',
    bg: 'var(--status-error-bg)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
} as const

export default function LogsPanel({ logs, onClear }: LogsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* FM-30: Header label matches BannerControls section style */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
          Logs {logs.length > 0 && `(${logs.length})`}
        </span>
        {logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-interaction cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 && (
          <p className="text-[var(--text-disabled)] text-xs text-center py-4">No logs yet</p>
        )}

        {logs.map((log) => {
          const config = LEVEL_CONFIG[log.level]
          return (
            <div
              key={log.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded text-xs"
              style={{ backgroundColor: config.bg }}
            >
              {/* FM-28: SVG icon colored by status token */}
              <span className="flex-shrink-0 mt-px" style={{ color: config.color }}>
                {config.icon}
              </span>
              {/* FM-31: Message text uses text-secondary, timestamp uses text-tertiary */}
              <span className="text-[var(--text-secondary)] flex-1">{log.message}</span>
              <span className="text-[var(--text-tertiary)] flex-shrink-0">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
