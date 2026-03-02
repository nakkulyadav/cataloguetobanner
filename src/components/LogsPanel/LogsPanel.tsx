import type { LogEntry } from '@/types'

interface LogsPanelProps {
  logs: LogEntry[]
  onClear: () => void
}

const LEVEL_STYLES = {
  info: { icon: 'i', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  warning: { icon: '!', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  error: { icon: '✕', color: 'text-red-400', bg: 'bg-red-400/10' },
} as const

export default function LogsPanel({ logs, onClear }: LogsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Logs {logs.length > 0 && `(${logs.length})`}
        </span>
        {logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-4">No logs yet</p>
        )}

        {logs.map((log) => {
          const style = LEVEL_STYLES[log.level]
          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs ${style.bg}`}
            >
              <span className={`font-bold flex-shrink-0 w-3 text-center ${style.color}`}>
                {style.icon}
              </span>
              <span className="text-gray-300 flex-1">{log.message}</span>
              <span className="text-gray-600 flex-shrink-0">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
