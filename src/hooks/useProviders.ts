import { useState, useEffect, useCallback } from 'react'
import { searchCatalog } from '@/services/apiService'
import { extractProviders } from '@/services/catalogueParser'
import { useDebounce } from '@/hooks/useDebounce'
import { DEFAULT_PAGE_SIZE } from '@/constants/apiConfig'
import type { ApiProvider } from '@/types'

interface UseProvidersResult {
  providers: ApiProvider[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
}

/**
 * Fetches and manages the list of providers for a given BPP + domain.
 *
 * - Debounces the search input at 300ms to avoid excessive API calls.
 * - Uses AbortController to cancel stale requests on param changes.
 * - Supports pagination via loadMore().
 * - Resets providers when bppId or domain changes.
 */
export function useProviders(
  bppId: string | null,
  domain: string | null,
  search: string,
): UseProvidersResult {
  const [providers, setProviders] = useState<ApiProvider[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  // Fetch providers when bppId, domain, or debounced search changes
  useEffect(() => {
    // Guard: both BPP and domain are required
    if (!bppId || !domain) {
      setProviders([])
      setPage(1)
      setTotalPages(1)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    // Reset to page 1 on param change
    setPage(1)

    searchCatalog(
      {
        bppId,
        domain,
        search: debouncedSearch || undefined,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
      },
      controller.signal,
    )
      .then(response => {
        const extracted = extractProviders(response.data)
        setProviders(extracted)
        setTotalPages(response.totalPages)
        setIsLoading(false)
      })
      .catch(err => {
        // Ignore AbortErrors from stale request cancellation
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [bppId, domain, debouncedSearch])

  // Load next page and append unique providers
  const loadMore = useCallback(() => {
    if (!bppId || !domain || isLoading || page >= totalPages) return

    const nextPage = page + 1
    setIsLoading(true)

    searchCatalog({
      bppId,
      domain,
      search: debouncedSearch || undefined,
      page: nextPage,
      pageSize: DEFAULT_PAGE_SIZE,
    })
      .then(response => {
        const extracted = extractProviders(response.data)
        setProviders(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newOnes = extracted.filter(p => !existingIds.has(p.id))
          return [...prev, ...newOnes]
        })
        setPage(nextPage)
        setTotalPages(response.totalPages)
        setIsLoading(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })
  }, [bppId, domain, debouncedSearch, isLoading, page, totalPages])

  return {
    providers,
    isLoading,
    error,
    hasMore: page < totalPages,
    loadMore,
  }
}
