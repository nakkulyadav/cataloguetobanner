import { useState, useEffect, useCallback } from 'react'
import { searchCatalog } from '@/services/apiService'
import { parseApiItems, groupProducts, getProductsWithMissingImages } from '@/services/catalogueParser'
import { DEFAULT_PAGE_SIZE } from '@/constants/apiConfig'
import type { ParsedProduct, ProductGroup } from '@/types'

interface UseProviderProductsResult {
  products: ParsedProduct[]
  groups: ProductGroup[]
  missingImageProducts: ParsedProduct[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
}

/**
 * Fetches products for a selected provider and parses them into
 * deduplicated, grouped ParsedProducts.
 *
 * - Uses AbortController to cancel stale requests on provider change.
 * - Supports pagination via loadMore().
 * - Resets all state when providerUniqueId changes.
 */
export function useProviderProducts(
  providerUniqueId: string | null,
): UseProviderProductsResult {
  const [products, setProducts] = useState<ParsedProduct[]>([])
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [missingImageProducts, setMissingImageProducts] = useState<ParsedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch first page when provider changes
  useEffect(() => {
    if (!providerUniqueId) {
      setProducts([])
      setGroups([])
      setMissingImageProducts([])
      setPage(1)
      setTotalPages(1)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setPage(1)

    searchCatalog(
      { providerUniqueId, page: 1, pageSize: DEFAULT_PAGE_SIZE },
      controller.signal,
    )
      .then(response => {
        const parsed = parseApiItems(response.data)
        const grouped = groupProducts(parsed)
        const missing = getProductsWithMissingImages(parsed)

        setProducts(parsed)
        setGroups(grouped)
        setMissingImageProducts(missing)
        setTotalPages(response.totalPages)
        setIsLoading(false)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [providerUniqueId])

  // Load next page and append products
  const loadMore = useCallback(() => {
    if (!providerUniqueId || isLoading || page >= totalPages) return

    const nextPage = page + 1
    setIsLoading(true)

    searchCatalog({
      providerUniqueId,
      page: nextPage,
      pageSize: DEFAULT_PAGE_SIZE,
    })
      .then(response => {
        const newParsed = parseApiItems(response.data)

        setProducts(prev => {
          // Deduplicate against already-loaded products
          const existingIds = new Set(prev.map(p => p.id))
          const unique = newParsed.filter(p => !existingIds.has(p.id))
          const combined = [...prev, ...unique]

          // Re-group and re-compute missing images for the full set
          setGroups(groupProducts(combined))
          setMissingImageProducts(getProductsWithMissingImages(combined))

          return combined
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
  }, [providerUniqueId, isLoading, page, totalPages])

  return {
    products,
    groups,
    missingImageProducts,
    isLoading,
    error,
    hasMore: page < totalPages,
    loadMore,
  }
}
