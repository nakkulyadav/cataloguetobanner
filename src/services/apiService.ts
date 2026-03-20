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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    // Try to extract debug info if the proxy returned a structured error
    let detail = ''
    try {
      const errBody = await response.clone().json() as Record<string, unknown>
      detail = ` [${errBody.backendStatus} ${errBody.backendContentType} — ${errBody.backendBodySnippet}]`
    } catch { /* ignore */ }
    throw new Error(`API returned an unexpected response${detail}`)
  }

  return response.json() as Promise<ApiPaginatedResponse<ApiCatalogItem>>
}
