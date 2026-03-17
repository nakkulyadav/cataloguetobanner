import { useState, useCallback } from 'react'
import { searchCatalog } from '@/services/apiService'
import {
  parseApiItems,
  groupProducts,
  getProductsWithMissingImages,
  extractProviders,
} from '@/services/catalogueParser'
import type { ParsedProduct, ProductGroup, ApiProvider } from '@/types'

/** Result shape for a provider ID lookup (fetches products for that provider) */
interface ProviderLookupResult {
  provider: ApiProvider | null
  products: ParsedProduct[]
  groups: ProductGroup[]
  missingImageProducts: ParsedProduct[]
}

/** Result shape for an item ID lookup (fetches a single product) */
interface ItemLookupResult {
  product: ParsedProduct | null
}

interface UseDirectLookupReturn {
  /** Loading state for either lookup type */
  isLoading: boolean
  /** Error message from the most recent lookup attempt */
  error: string | null
  /** Result from a provider ID lookup */
  providerResult: ProviderLookupResult | null
  /** Result from an item ID lookup */
  itemResult: ItemLookupResult | null
  /** Whether a direct lookup is currently active (has results) */
  isActive: boolean
  /** Look up a provider by its unique ID — fetches all products for that provider */
  lookupProvider: (providerId: string) => Promise<void>
  /** Look up a single item by its item ID — auto-selects the product */
  lookupItem: (itemId: string) => Promise<void>
  /** Clear all direct lookup state and return to browse mode */
  clear: () => void
}

/**
 * Hook for direct lookup by provider ID or item ID, bypassing the
 * BPP > Domain > Provider browse flow.
 *
 * - Provider ID lookup: fetches products via `provider_unique_id`, extracts
 *   provider metadata from the first result, and parses/groups products.
 * - Item ID lookup: fetches a single item via `item_id`, parses it into
 *   a ParsedProduct for immediate banner selection.
 * - Both use AbortController to cancel in-flight requests on new lookups.
 */
export function useDirectLookup(): UseDirectLookupReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerResult, setProviderResult] = useState<ProviderLookupResult | null>(null)
  const [itemResult, setItemResult] = useState<ItemLookupResult | null>(null)
  // Track current abort controller so concurrent lookups cancel previous ones
  const [controller, setController] = useState<AbortController | null>(null)

  const clear = useCallback(() => {
    controller?.abort()
    setProviderResult(null)
    setItemResult(null)
    setError(null)
    setIsLoading(false)
    setController(null)
  }, [controller])

  const lookupProvider = useCallback(async (providerId: string) => {
    // Abort any in-flight request
    controller?.abort()
    const newController = new AbortController()
    setController(newController)

    // Clear previous results
    setItemResult(null)
    setProviderResult(null)
    setError(null)
    setIsLoading(true)

    try {
      const response = await searchCatalog(
        { providerUniqueId: providerId, page: 1, pageSize: 50 },
        newController.signal,
      )

      if (response.data.length === 0) {
        setError(`No products found for provider ID "${providerId}"`)
        setIsLoading(false)
        return
      }

      // Extract provider metadata from the first item's provider_details
      const providers = extractProviders(response.data)
      const provider = providers[0] ?? null

      const parsed = parseApiItems(response.data)
      const groups = groupProducts(parsed)
      const missing = getProductsWithMissingImages(parsed)

      setProviderResult({ provider, products: parsed, groups, missingImageProducts: missing })
      setIsLoading(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
      setIsLoading(false)
    }
  }, [controller])

  const lookupItem = useCallback(async (itemId: string) => {
    // Abort any in-flight request
    controller?.abort()
    const newController = new AbortController()
    setController(newController)

    // Clear previous results
    setProviderResult(null)
    setItemResult(null)
    setError(null)
    setIsLoading(true)

    try {
      const response = await searchCatalog(
        { itemId, page: 1, pageSize: 1 },
        newController.signal,
      )

      if (response.data.length === 0) {
        setError(`No item found with ID "${itemId}"`)
        setIsLoading(false)
        return
      }

      const parsed = parseApiItems(response.data)
      const product = parsed[0] ?? null

      setItemResult({ product })
      setIsLoading(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
      setIsLoading(false)
    }
  }, [controller])

  const isActive = providerResult !== null || itemResult !== null

  return {
    isLoading,
    error,
    providerResult,
    itemResult,
    isActive,
    lookupProvider,
    lookupItem,
    clear,
  }
}
