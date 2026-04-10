import { useState, useCallback, useRef } from 'react'
import {
  fetchSheetRows,
  filterRowsForDate,
  extractProductUrl,
  extractPrice,
  parseComments,
} from '@/services/sheetsService'
import { searchCatalog } from '@/services/apiService'
import { parseApiItems } from '@/services/catalogueParser'
import { parseDigihaatUrl } from '@/hooks/useDirectLookup'
import { BACKGROUND_OPTIONS } from '@/constants/backgrounds'
import { removeBackground } from '@/services/removeBackgroundService'
import type { BannerState, ScheduledBannerEntry, SheetRow, ImageSource } from '@/types'

// ---------------------------------------------------------------------------
// Default BannerState values — mirrors useBannerState initial state
// ---------------------------------------------------------------------------

/**
 * Returns a base BannerState with sensible defaults for a scheduled banner.
 * Callers merge product + override fields on top of this.
 */
function defaultBannerState(): Omit<BannerState, 'selectedProduct'> {
  return {
    selectedBackground: BACKGROUND_OPTIONS[0] ?? null,
    ctaText: 'SHOP NOW',
    badgeText: 'Free Delivery',
    showTnc: true,
    showBadge: true,
    showPrice: true,
    showLogo: true,
    showHeading: true,
    showCta: true,
    showSubheading: false,
    subheadingText: '',
    tncText: '*T&C Apply',
    brandLogoOverride: null,
    productNameOverride: null,
    priceOverride: null,
    productImageSources: [],
    activeProductImageSourceId: null,
    logoScale: 1,
    productImageScale: 1,
    quantityStickerText: null,
    showQuantitySticker: false,
  }
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseScheduledBannersReturn {
  /** Currently selected date string (YYYY-MM-DD, the native date input format) */
  selectedDate: string
  /** Update the selected date; triggers an automatic sheet fetch + banner load */
  setDate: (date: string) => void
  /** True while the Google Sheet is being fetched */
  isFetching: boolean
  /** Sheet-level error (fetch failed or no rows matched) */
  fetchError: string | null
  /** One entry per matching sheet row, in order */
  entries: ScheduledBannerEntry[]
  /**
   * Patches only the matching entry's `bannerState` with `state`, leaving
   * all other entry fields untouched.
   */
  updateEntryState: (id: string, state: BannerState) => void
  /**
   * Flips `showBgRemovedLogo` on the matching entry only.
   */
  toggleEntryBgRemovedLogo: (id: string) => void
  /**
   * Flips `showBgRemoved` on the matching source within the entry's
   * `bannerState.productImageSources`.
   */
  toggleEntrySourceBgRemoved: (entryId: string, sourceId: string) => void
  /**
   * Updates `bannerState.activeProductImageSourceId` on the matching entry.
   */
  setEntryActiveSource: (entryId: string, sourceId: string) => void
  /**
   * Removes the product-image and brand-logo backgrounds for a single entry.
   * Product bg-removal state lives in per-source ImageSource entries.
   * Logo result is stored in `entry.bgRemovedLogoUrl`.
   */
  removeEntryBackground: (id: string) => Promise<void>
  /** True while any removeEntryBackground call is actively processing */
  isRemovingBg: boolean
}

// ---------------------------------------------------------------------------
// useScheduledBanners
// ---------------------------------------------------------------------------

export function useScheduledBanners(): UseScheduledBannersReturn {
  const [selectedDate, setSelectedDate] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ScheduledBannerEntry[]>([])

  const controllerRef = useRef<AbortController | null>(null)

  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const removeBgAbortRef = useRef(false)
  const removeBgInProgressRef = useRef(false)
  const entriesRef = useRef<ScheduledBannerEntry[]>([])

  const syncedSetEntries = useCallback(
    (updater: (prev: ScheduledBannerEntry[]) => ScheduledBannerEntry[]) => {
      const next = updater(entriesRef.current)
      entriesRef.current = next
      setEntries(next)
    },
    [],
  )

  const resolveEntry = useCallback(
    async (row: SheetRow, id: string, signal: AbortSignal): Promise<void> => {
      const productUrl = extractProductUrl(row.offerCallout)
      if (!productUrl) {
        syncedSetEntries(prev =>
          prev.map(e =>
            e.id === id
              ? { ...e, status: 'error', error: 'No product URL found in Offer callout' }
              : e,
          ),
        )
        return
      }

      const params = parseDigihaatUrl(productUrl)
      if (!params) {
        syncedSetEntries(prev =>
          prev.map(e =>
            e.id === id
              ? { ...e, status: 'error', error: 'Invalid product URL in Offer callout' }
              : e,
          ),
        )
        return
      }

      try {
        const response = await searchCatalog(
          { search: params.itemId, page: 1, pageSize: 10 },
          signal,
        )

        if (signal.aborted) return

        if (response.data.length === 0) {
          syncedSetEntries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, status: 'error', error: 'Product not found in catalogue' } : e,
            ),
          )
          return
        }

        const parsed = parseApiItems(response.data)
        const product = parsed.find(p => p.id === params.itemId) ?? parsed[0]

        if (!product) {
          syncedSetEntries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, status: 'error', error: 'Failed to parse product data' } : e,
            ),
          )
          return
        }

        const { heading, subheading } = parseComments(row.comments)
        const priceStr = extractPrice(row.offerCallout)

        // Initialise the catalogue image source
        const productImageSources: ImageSource[] = product.imageUrl
          ? [{
              id: 'catalogue',
              label: 'Catalogue',
              originalUrl: product.imageUrl,
              bgRemovedUrl: null,
              bgRemovalStatus: 'idle',
              showBgRemoved: false,
              source: 'catalogue',
            }]
          : []

        const bannerState: BannerState = {
          ...defaultBannerState(),
          selectedProduct: product,
          productImageSources,
          activeProductImageSourceId: productImageSources[0]?.id ?? null,
          productNameOverride: heading || null,
          showSubheading: !!subheading,
          subheadingText: subheading,
          priceOverride: priceStr
            ? {
                mrp: product.price?.mrp ?? priceStr,
                sellingPrice: priceStr,
              }
            : null,
          quantityStickerText: row.quantitySticker || null,
          showQuantitySticker: !!row.quantitySticker,
        }

        syncedSetEntries(prev =>
          prev.map(e =>
            e.id === id ? { ...e, status: 'ready', bannerState, error: null } : e,
          ),
        )
      } catch (err) {
        if (signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        syncedSetEntries(prev =>
          prev.map(e =>
            e.id === id ? { ...e, status: 'error', error: message } : e,
          ),
        )
      }
    },
    [syncedSetEntries],
  )

  const setDate = useCallback(
    (date: string) => {
      setSelectedDate(date)

      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller

      removeBgAbortRef.current = true

      // Revoke all blob URLs from the departing date's entries
      for (const entry of entriesRef.current) {
        if (entry.bannerState) {
          for (const source of entry.bannerState.productImageSources) {
            if (source.bgRemovedUrl?.startsWith('blob:')) URL.revokeObjectURL(source.bgRemovedUrl)
            if (source.source === 'user' && source.originalUrl.startsWith('blob:')) {
              URL.revokeObjectURL(source.originalUrl)
            }
          }
        }
        if (entry.bgRemovedLogoUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(entry.bgRemovedLogoUrl)
        }
      }

      entriesRef.current = []
      setEntries([])
      setFetchError(null)

      if (!date) return

      const [y, m, d] = date.split('-')
      const sheetDate = `${m}/${d}/${y}`

      setIsFetching(true)

      ;(async () => {
        try {
          const allRows = await fetchSheetRows(signal)
          if (signal.aborted) return

          const matchedRows = filterRowsForDate(allRows, sheetDate)

          if (matchedRows.length === 0) {
            setFetchError(`No Bazar Page banners scheduled for ${sheetDate}`)
            setIsFetching(false)
            return
          }

          const initialEntries: ScheduledBannerEntry[] = matchedRows.map((row, i) => ({
            id: `sb-${date}-${i}`,
            sheetRow: row,
            status: 'loading',
            bannerState: null,
            error: null,
            bgRemovalStatus: 'idle',
            bgRemovalError: null,
            bgRemovedLogoUrl: null,
            showBgRemovedLogo: true,
          }))

          entriesRef.current = initialEntries
          setEntries(initialEntries)
          setIsFetching(false)

          await Promise.allSettled(
            initialEntries.map(entry => resolveEntry(entry.sheetRow, entry.id, signal)),
          )

          // Auto BG removal — process ready entries one at a time
          if (!signal.aborted) {
            removeBgAbortRef.current = false
            for (const entry of entriesRef.current) {
              if (signal.aborted || removeBgAbortRef.current) break
              if (entry.status === 'ready') {
                await removeEntryBackground(entry.id)
              }
            }
          }
        } catch (err) {
          if (signal.aborted) return
          const message = err instanceof Error ? err.message : String(err)
          setFetchError(`Failed to load promotions sheet: ${message}`)
          setIsFetching(false)
        }
      })()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolveEntry],
  )

  const updateEntryState = useCallback(
    (id: string, state: BannerState) => {
      syncedSetEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, bannerState: state } : e)),
      )
    },
    [syncedSetEntries],
  )

  const toggleEntryBgRemovedLogo = useCallback(
    (id: string) => {
      syncedSetEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, showBgRemovedLogo: !e.showBgRemovedLogo } : e)),
      )
    },
    [syncedSetEntries],
  )

  const toggleEntrySourceBgRemoved = useCallback(
    (entryId: string, sourceId: string) => {
      syncedSetEntries(prev =>
        prev.map(e => {
          if (e.id !== entryId || !e.bannerState) return e
          return {
            ...e,
            bannerState: {
              ...e.bannerState,
              productImageSources: e.bannerState.productImageSources.map(s =>
                s.id === sourceId ? { ...s, showBgRemoved: !s.showBgRemoved } : s,
              ),
            },
          }
        }),
      )
    },
    [syncedSetEntries],
  )

  const setEntryActiveSource = useCallback(
    (entryId: string, sourceId: string) => {
      syncedSetEntries(prev =>
        prev.map(e => {
          if (e.id !== entryId || !e.bannerState) return e
          return {
            ...e,
            bannerState: {
              ...e.bannerState,
              activeProductImageSourceId: sourceId,
            },
          }
        }),
      )
    },
    [syncedSetEntries],
  )

  const removeEntryBackground = useCallback(async (id: string) => {
    if (removeBgInProgressRef.current) return
    removeBgInProgressRef.current = true
    removeBgAbortRef.current = false
    setIsRemovingBg(true)

    const entry = entriesRef.current.find(e => e.id === id)
    if (!entry || entry.status !== 'ready' || !entry.bannerState) {
      removeBgInProgressRef.current = false
      setIsRemovingBg(false)
      return
    }

    if (entry.bgRemovalStatus === 'removing' || entry.bgRemovalStatus === 'done') {
      removeBgInProgressRef.current = false
      setIsRemovingBg(false)
      return
    }

    // Find idle product image sources to process
    const idleSources = entry.bannerState.productImageSources.filter(
      s => s.bgRemovalStatus === 'idle',
    )

    if (idleSources.length === 0 && !entry.bannerState.selectedProduct?.provider.brandLogo) {
      removeBgInProgressRef.current = false
      setIsRemovingBg(false)
      return
    }

    // Mark entry as actively processing
    syncedSetEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, bgRemovalStatus: 'removing' as const } : e)),
    )

    // Mark all idle sources as 'removing'
    if (idleSources.length > 0) {
      syncedSetEntries(prev =>
        prev.map(e => {
          if (e.id !== id || !e.bannerState) return e
          return {
            ...e,
            bannerState: {
              ...e.bannerState,
              productImageSources: e.bannerState.productImageSources.map(s =>
                idleSources.some(is => is.id === s.id)
                  ? { ...s, bgRemovalStatus: 'removing' as const }
                  : s,
              ),
            },
          }
        }),
      )
    }

    // Process each idle source sequentially
    for (const source of idleSources) {
      if (removeBgAbortRef.current) break
      try {
        const resultUrl = await removeBackground(source.originalUrl)
        if (removeBgAbortRef.current) { URL.revokeObjectURL(resultUrl); break }
        syncedSetEntries(prev =>
          prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return {
              ...e,
              bannerState: {
                ...e.bannerState,
                productImageSources: e.bannerState.productImageSources.map(s =>
                  s.id === source.id
                    ? { ...s, bgRemovedUrl: resultUrl, bgRemovalStatus: 'done' as const, showBgRemoved: true }
                    : s,
                ),
              },
            }
          }),
        )
      } catch (err) {
        syncedSetEntries(prev =>
          prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return {
              ...e,
              bannerState: {
                ...e.bannerState,
                productImageSources: e.bannerState.productImageSources.map(s =>
                  s.id === source.id ? { ...s, bgRemovalStatus: 'error' as const } : s,
                ),
              },
            }
          }),
        )
      }
    }

    // --- Logo background removal ---
    const currentEntry = entriesRef.current.find(e => e.id === id)
    const logoUrl =
      currentEntry?.bannerState?.brandLogoOverride ??
      currentEntry?.bannerState?.selectedProduct?.provider.brandLogo

    let logoError: string | null = null

    if (logoUrl && !removeBgAbortRef.current) {
      try {
        const logoResultUrl = await removeBackground(logoUrl)

        if (removeBgAbortRef.current) {
          URL.revokeObjectURL(logoResultUrl)
          removeBgInProgressRef.current = false
          setIsRemovingBg(false)
          return
        }

        syncedSetEntries(prev =>
          prev.map(e => {
            if (e.id !== id) return e
            const oldLogoUrl = e.bgRemovedLogoUrl
            if (oldLogoUrl?.startsWith('blob:')) URL.revokeObjectURL(oldLogoUrl)
            return { ...e, bgRemovedLogoUrl: logoResultUrl }
          }),
        )
      } catch (logoErr) {
        logoError = logoErr instanceof Error ? logoErr.message : String(logoErr)
      }
    }

    syncedSetEntries(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              bgRemovalStatus: 'done' as const,
              bgRemovalError: logoError ? `Product bg: ok | Logo bg: ${logoError}` : null,
            }
          : e,
      ),
    )

    removeBgInProgressRef.current = false
    setIsRemovingBg(false)
  }, [syncedSetEntries]) // stable — reads state via entriesRef

  return {
    selectedDate,
    setDate,
    isFetching,
    fetchError,
    entries,
    updateEntryState,
    toggleEntryBgRemovedLogo,
    toggleEntrySourceBgRemoved,
    setEntryActiveSource,
    removeEntryBackground,
    isRemovingBg,
  }
}
