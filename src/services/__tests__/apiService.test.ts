import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchCatalog } from '../apiService'
import { API_BASE_URL } from '@/constants/apiConfig'

const mockResponse = {
  data: [{ id: '1', item_id: 'item-1', item_name: 'Test' }],
  total: 1,
  page: 1,
  pageSize: 50,
  totalPages: 1,
}

describe('searchCatalog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns typed ApiPaginatedResponse on success', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    const result = await searchCatalog({ bppId: 'test', domain: 'ONDC:RET10' })

    expect(result).toEqual(mockResponse)
    expect(result.data).toHaveLength(1)
    expect(result.totalPages).toBe(1)
  })

  it('builds URL with bppId + domain params', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    await searchCatalog({ bppId: 'Rebel Foods', domain: 'ONDC:RET10' })

    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toContain('bpp_id=Rebel+Foods')
    expect(calledUrl).toContain('domain=ONDC%3ARET10')
  })

  it('builds URL with providerUniqueId param', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    await searchCatalog({ providerUniqueId: 'prov-123' })

    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toContain('provider_unique_id=prov-123')
  })

  it('includes search param when provided', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    await searchCatalog({ bppId: 'test', domain: 'ONDC:RET10', search: 'seeds' })

    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toContain('search=seeds')
  })

  it('includes page and pageSize params', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    await searchCatalog({ bppId: 'test', domain: 'ONDC:RET10', page: 2, pageSize: 25 })

    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toContain('page=2')
    expect(calledUrl).toContain('pageSize=25')
  })

  it('throws on non-OK response with status info', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      // Empty content-type so the plain HTTP error path is exercised (not the JSON proxy path)
      headers: { get: vi.fn().mockReturnValue('') },
    })

    await expect(searchCatalog({ bppId: 'test' })).rejects.toThrow(
      'HTTP 500: Internal Server Error',
    )
  })

  it('passes AbortSignal to fetch', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    const controller = new AbortController()
    await searchCatalog({ bppId: 'test' }, controller.signal)

    const calledOptions = (fetch as any).mock.calls[0][1] as RequestInit
    expect(calledOptions.signal).toBe(controller.signal)
  })

  it('uses the correct base URL', async () => {
    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: () => Promise.resolve(mockResponse),
    })

    await searchCatalog({ bppId: 'test' })

    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toContain(API_BASE_URL)
  })
})
