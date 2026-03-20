import { API_BASE_URL } from '@/constants/apiConfig'
import type { ApiCatalogItem, ApiPaginatedResponse } from '@/types'

export interface SearchCatalogParams {
  bppId?: string
  domain?: string
  search?: string
  providerUniqueId?: string
  page?: number
  pageSize?: number
}

/**
 * Single fetch wrapper for the Digihaat catalogue search API.
 *
 * Both provider discovery (bppId + domain + search) and product fetching
 * (providerUniqueId) use the same endpoint with different query params.
 *
 * @param params  Query parameters to include in the request
 * @param signal  Optional AbortSignal for cancelling stale requests
 * @returns       Paginated response of API catalogue items
 */
export async function searchCatalog(
  params: SearchCatalogParams,
  signal?: AbortSignal,
): Promise<ApiPaginatedResponse<ApiCatalogItem>> {
  const qp = new URLSearchParams()

  if (params.bppId) qp.set('bpp_id', params.bppId)
  if (params.domain) qp.set('domain', params.domain)
  if (params.search) qp.set('search', params.search)
  if (params.providerUniqueId) qp.set('provider_unique_id', params.providerUniqueId)
  if (params.page != null) qp.set('page', String(params.page))
  if (params.pageSize != null) qp.set('pageSize', String(params.pageSize))

  const response = await fetch(`${API_BASE_URL}?${qp.toString()}`, { signal })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!response.ok) {
    // Proxy may have returned a structured JSON error — extract debug info if so
    if (isJson) {
      try {
        const errBody = await response.json() as Record<string, unknown>
        const snippet = errBody.backendBodySnippet ? ` — ${errBody.backendBodySnippet}` : ''
        throw new Error(`Proxy error: backend returned ${errBody.backendStatus} (${errBody.backendContentType})${snippet}`)
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Proxy error:')) throw e
      }
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  if (!isJson) {
    throw new Error('API returned an unexpected response — the proxy may not be running (got HTML instead of JSON)')
  }

  return response.json() as Promise<ApiPaginatedResponse<ApiCatalogItem>>
}
