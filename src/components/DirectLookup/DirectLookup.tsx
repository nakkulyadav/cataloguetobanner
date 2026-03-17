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
  /** Trigger a product URL lookup */
  onLookupByUrl: (url: string) => void
  /** Clear direct lookup results and return to browse mode */
  onClear: () => void
}

/**
 * Direct Lookup panel — a product URL field and a provider ID field to bypass
 * the BPP > Domain > Provider browse flow.
 *
 * Renders as a collapsible section at the top of the left sidebar.
 */
export default function DirectLookup({
  isActive,
  isLoading,
  error,
  onLookupProvider,
  onLookupByUrl,
  onClear,
}: DirectLookupProps) {
  const [providerIdInput, setProviderIdInput] = useState('')
  const [productUrlInput, setProductUrlInput] = useState('')

  const handleProviderSubmit = useCallback(() => {
    const trimmed = providerIdInput.trim()
    if (!trimmed) return
    onLookupProvider(trimmed)
  }, [providerIdInput, onLookupProvider])

  const handleUrlSubmit = useCallback(() => {
    const trimmed = productUrlInput.trim()
    if (!trimmed) return
    onLookupByUrl(trimmed)
  }, [productUrlInput, onLookupByUrl])

  const handleClear = useCallback(() => {
    setProviderIdInput('')
    setProductUrlInput('')
    onClear()
  }, [onClear])

  /** Submit on Enter key for both inputs */
  const handleProviderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleProviderSubmit()
  }, [handleProviderSubmit])

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUrlSubmit()
  }, [handleUrlSubmit])

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

        {/* Product URL input */}
        <div className="space-y-1">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Paste product link..."
              value={productUrlInput}
              onChange={e => setProductUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              disabled={isLoading}
              className="input-base flex-1 !text-xs !py-1.5"
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={isLoading || !productUrlInput.trim()}
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
