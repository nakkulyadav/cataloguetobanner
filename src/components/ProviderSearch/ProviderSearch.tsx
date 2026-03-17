import { useState, useMemo } from 'react'
import { BPP_OPTIONS, DOMAIN_OPTIONS } from '@/constants/apiConfig'
import type { ApiProvider } from '@/types'

interface ProviderSearchProps {
  providers: ApiProvider[]
  isLoading: boolean
  error: string | null
  bppId: string | null
  domain: string | null
  providerSearch: string
  onBppChange: (bppId: string) => void
  onDomainChange: (domain: string) => void
  onProviderSearchChange: (search: string) => void
  onSelectProvider: (provider: ApiProvider) => void
  hasMore: boolean
  onLoadMore: () => void
}

export default function ProviderSearch({
  providers,
  isLoading,
  error,
  bppId,
  domain,
  providerSearch,
  onBppChange,
  onDomainChange,
  onProviderSearchChange,
  onSelectProvider,
  hasMore,
  onLoadMore,
}: ProviderSearchProps) {
  const [bppFilter, setBppFilter] = useState('')
  const [isBppOpen, setIsBppOpen] = useState(false)

  // Client-side filter for BPP dropdown options
  const filteredBpps = useMemo(() => {
    if (!bppFilter) return BPP_OPTIONS
    const lower = bppFilter.toLowerCase()
    return BPP_OPTIONS.filter(b => b.toLowerCase().includes(lower))
  }, [bppFilter])

  return (
    <div className="flex flex-col h-full">
      {/* BPP Selector */}
      <div className="p-3 space-y-2 border-b border-[var(--border-subtle)]">
        {/* BPP Dropdown (searchable) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBppOpen(prev => !prev)}
            className="input-base w-full text-left flex items-center justify-between cursor-pointer"
          >
            <span className={bppId ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
              {bppId
                ? (bppId.length > 28 ? bppId.slice(0, 28) + '...' : bppId)
                : 'Select BPP...'}
            </span>
            <svg
              className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isBppOpen && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-[var(--surface-2)] border border-[var(--border-muted)] rounded-lg shadow-lg">
              {/* Search within BPP options */}
              <div className="p-2 sticky top-0 bg-[var(--surface-2)] border-b border-[var(--border-subtle)]">
                <input
                  type="text"
                  placeholder="Filter BPPs..."
                  value={bppFilter}
                  onChange={e => setBppFilter(e.target.value)}
                  className="input-base !py-1.5 !text-xs"
                  autoFocus
                />
              </div>
              {filteredBpps.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    onBppChange(b)
                    setIsBppOpen(false)
                    setBppFilter('')
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-interaction cursor-pointer ${
                    b === bppId
                      ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                      : 'hover:bg-[var(--surface-3)] text-[var(--text-secondary)]'
                  }`}
                >
                  {b}
                </button>
              ))}
              {filteredBpps.length === 0 && (
                <p className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No BPPs match filter</p>
              )}
            </div>
          )}
        </div>

        {/* Domain Dropdown */}
        <select
          value={domain || ''}
          onChange={e => onDomainChange(e.target.value)}
          className="input-base w-full cursor-pointer"
        >
          <option value="" disabled>Select Domain...</option>
          {DOMAIN_OPTIONS.map(d => (
            <option key={d.code} value={d.code}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Provider Search Input */}
      {bppId && domain && (
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search providers..."
              value={providerSearch}
              onChange={e => onProviderSearchChange(e.target.value)}
              className="input-base !pl-8"
            />
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* Empty states */}
        {!bppId || !domain ? (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-8 px-4">
            Select a BPP and domain to browse providers
          </p>
        ) : error ? (
          <p className="text-[var(--status-error)] text-sm text-center py-4 px-4">
            {error}
          </p>
        ) : !isLoading && providers.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-8 px-4">
            No providers found for this BPP and domain
          </p>
        ) : (
          <>
            {providers.map(provider => (
              <button
                key={provider.id}
                type="button"
                onClick={() => onSelectProvider(provider)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-interaction cursor-pointer hover:bg-[var(--surface-2)] flex items-center gap-3"
              >
                {/* Provider logo thumbnail */}
                {provider.logo && (
                  <img
                    src={provider.logo}
                    alt=""
                    className="w-8 h-8 object-contain flex-shrink-0 rounded bg-white"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[var(--text-primary)]">{provider.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                      ({provider.totalItems})
                    </span>
                  </div>
                  {(provider.city || provider.state) && (
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {[provider.city, provider.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}

            {/* Load More */}
            {hasMore && !isLoading && (
              <button
                type="button"
                onClick={onLoadMore}
                className="w-full py-2 mt-1 text-xs text-[var(--accent-base)] hover:text-[var(--accent-hover)] transition-interaction cursor-pointer"
              >
                Load more providers
              </button>
            )}
          </>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <p className="text-[var(--text-tertiary)] text-sm text-center py-4">
            Searching providers...
          </p>
        )}
      </div>
    </div>
  )
}
