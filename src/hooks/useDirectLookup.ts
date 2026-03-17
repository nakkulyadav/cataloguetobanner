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

/** Result shape for a product URL lookup (fetches a single product) */
interface ItemLookupResult {
  product: ParsedProduct | null
}

/** Params extracted from a Digihaat product page URL */
export interface DigihaatUrlParams {
  itemId: string
  bppId: string | null
  domain: string | null
  providerId: string | null
}

/**
 * Parses a Digihaat product URL and extracts the query params needed for lookup.
 * Expected format: https://digihaat.in/en/product?item_id=...&bpp_id=...&domain=...&provider_id=...
 *
 * Returns null if the URL is invalid or missing the required `item_id` param.
 */
export function parseDigihaatUrl(input: string): DigihaatUrlParams | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (!url.hostname.endsWith('digihaat.in')) return null

  const itemId = url.searchParams.get('item_id')
  if (!itemId) return null

  return {
    itemId,
    bppId: url.searchParams.get('bpp_id'),
    domain: url.searchParams.get('domain'),
    providerId: url.searchParams.get('provider_id'),
  }
}

interface UseDirectLookupReturn {
  /** Loading state for either lookup type */
  isLoading: boolean
  /** Error message from the most recent lookup attempt */
  error: string | null
  /** Result from a provider ID lookup */
  providerResult: ProviderLookupResult | null
  /** Result from a product URL lookup */
  itemResult: ItemLookupResult | null
  /** Whether a direct lookup is currently active (has results) */
  isActive: boolean
  /** Look up a provider by its unique ID — fetches all products for that provider */
  lookupProvider: (providerId: string) => Promise<void>
  /** Look up a single product by its Digihaat product page URL */
  lookupByUrl: (url: string) => Promise<void>
  /** Clear all direct lookup state and return to browse mode */
  clear: () => void
}

/**
 * Hook for direct lookup by provider ID or product URL, bypassing the
 * BPP > Domain > Provider browse flow.
 *
 * - Provider ID lookup: fetches products via `provider_unique_id`, extracts
 *   provider metadata from the first result, and parses/groups products.
 * - Product URL lookup: parses a Digihaat product page URL, fetches the
 *   exact item via `search` + `bpp_id` + `domain`, and auto-selects it.
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
      // First try the `provider_unique_id` param directly (works for composite
      // IDs like "ondcseller-prod.costbo.com_ONDC:RET14_<uuid>").
      let response = await searchCatalog(
        { providerUniqueId: providerId, page: 1, pageSize: 50 },
        newController.signal,
      )

      // If that returned nothing the user likely entered a short/local ID.
      // Use `search` to find any item with this ID, extract its composite
      // provider_unique_id, then re-query to get ALL products.
      if (response.data.length === 0) {
        const discovery = await searchCatalog(
          { search: providerId, page: 1, pageSize: 1 },
          newController.signal,
        )
        const compositeId = discovery.data[0]?.provider_unique_id
        if (compositeId) {
          response = await searchCatalog(
            { providerUniqueId: compositeId, page: 1, pageSize: 50 },
            newController.signal,
          )
        }
      }

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

  const lookupByUrl = useCallback(async (url: string) => {
    const params = parseDigihaatUrl(url)
    if (!params) {
      setError('Invalid URL — paste a digihaat.in product link')
      return
    }

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
      // The API does not support filtering by `item_id` query param directly,
      // and `search` returns 0 when combined with `bpp_id` + `domain` filters.
      // Use `search` alone — item IDs are unique enough for an exact match.
      const response = await searchCatalog(
        { search: params.itemId, page: 1, pageSize: 10 },
        newController.signal,
      )

      if (response.data.length === 0) {
        setError(`No product found for the provided link`)
        setIsLoading(false)
        return
      }

      const parsed = parseApiItems(response.data)
      // Prefer the exact item_id match; fall back to first result
      const product = parsed.find(p => p.id === params.itemId) ?? parsed[0] ?? null

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
    lookupByUrl,
    clear,
  }
}
