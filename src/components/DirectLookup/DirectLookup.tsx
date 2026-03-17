import { useState, useCallback } from 'react'

interface DirectLookupProps {
  /** Whether a direct lookup has returned results */
  isActive: boolean
  /** Whether a lookup request is in flight */
  isLoading: boolean
  /** Error message from the most recent lookup attempt */
  error: string | null
  /** Trigger a provider ID lookup */
  onLookupProvider: (providerId: string) => void
  /** Trigger an item ID lookup */
  onLookupItem: (itemId: string) => void
  /** Clear direct lookup results and return to browse mode */
  onClear: () => void
}

/**
 * Direct Lookup panel — two input fields for pasting a provider_unique_id or
 * item_id to bypass the BPP > Domain > Provider browse flow.
 *
 * Renders as a collapsible section at the top of the left sidebar.
 */
export default function DirectLookup({
  isActive,
  isLoading,
  error,
  onLookupProvider,
  onLookupItem,
  onClear,
}: DirectLookupProps) {
  const [providerIdInput, setProviderIdInput] = useState('')
  const [itemIdInput, setItemIdInput] = useState('')

  const handleProviderSubmit = useCallback(() => {
    const trimmed = providerIdInput.trim()
    if (!trimmed) return
    onLookupProvider(trimmed)
  }, [providerIdInput, onLookupProvider])

  const handleItemSubmit = useCallback(() => {
    const trimmed = itemIdInput.trim()
    if (!trimmed) return
    onLookupItem(trimmed)
  }, [itemIdInput, onLookupItem])

  const handleClear = useCallback(() => {
    setProviderIdInput('')
    setItemIdInput('')
    onClear()
  }, [onClear])

  /** Submit on Enter key for both inputs */
  const handleProviderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleProviderSubmit()
  }, [handleProviderSubmit])

  const handleItemKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleItemSubmit()
  }, [handleItemSubmit])

  return (
    <div className="border-b border-[var(--border-subtle)]">
      <div className="p-3 space-y-2">
        <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
          Direct Lookup
        </p>

        {/* Provider ID input */}
        <div className="space-y-1">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Provider ID..."
              value={providerIdInput}
              onChange={e => setProviderIdInput(e.target.value)}
              onKeyDown={handleProviderKeyDown}
              disabled={isLoading}
              className="input-base flex-1 !text-xs !py-1.5"
            />
            <button
              type="button"
              onClick={handleProviderSubmit}
              disabled={isLoading || !providerIdInput.trim()}
              className="px-2.5 py-1.5 text-xs rounded-md bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-white transition-interaction cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? '...' : 'Go'}
            </button>
          </div>
        </div>

        {/* Item ID input */}
        <div className="space-y-1">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Item ID..."
              value={itemIdInput}
              onChange={e => setItemIdInput(e.target.value)}
              onKeyDown={handleItemKeyDown}
              disabled={isLoading}
              className="input-base flex-1 !text-xs !py-1.5"
            />
            <button
              type="button"
              onClick={handleItemSubmit}
              disabled={isLoading || !itemIdInput.trim()}
              className="px-2.5 py-1.5 text-xs rounded-md bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-white transition-interaction cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? '...' : 'Go'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-[var(--status-error)]">{error}</p>
        )}

        {/* Clear / Back to Browse button (only visible when lookup is active) */}
        {isActive && (
          <button
            type="button"
            onClick={handleClear}
            className="w-full text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-interaction cursor-pointer py-1"
          >
            Clear lookup / Back to browse
          </button>
        )}
      </div>
    </div>
  )
}
