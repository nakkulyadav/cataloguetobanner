import { useState, useCallback, useRef, useEffect } from 'react'
import {
  fetchSheetRows,
  filterRowsForDate,
} from '@/services/sheetsService'
import { searchCatalog } from '@/services/apiService'
import { parseApiItems } from '@/services/catalogueParser'
import { parseDigihaatUrl } from '@/hooks/useDirectLookup'
import { removeBackground } from '@/services/removeBackgroundService'
import { enhanceImage } from '@/services/enhanceImageService'
import { generateAiProductImage, resizeLogoToFit } from '@/services/imageGenerationService'
import {
  saveScheduledEntry,
  loadScheduledEntry,
  clearScheduledEntry,
} from '@/services/persistenceService'
import type { BannerState, BackgroundOption, ScheduledBannerEntry, SheetRow, ImageSource, PersistedScheduledEntry } from '@/types'

// ---------------------------------------------------------------------------
// Default BannerState values — mirrors useBannerState initial state
// ---------------------------------------------------------------------------

/**
 * Returns a base BannerState with sensible defaults for a scheduled banner.
 * Callers merge product + override fields on top of this.
 */
function defaultBannerState(defaultBackground: BackgroundOption | null): Omit<BannerState, 'selectedProduct'> {
  return {
    selectedBackground: defaultBackground,
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
    logoImageSources: [],
    activeLogoImageSourceId: null,
    logoScale: 1,
    productImageScale: 1,
    quantityStickerText: null,
    showQuantitySticker: false,
    showOriginalLogo: false,
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
  /**
   * Generates an AI-enhanced product image and a resized logo for a single entry.
   * Sets `aiGenStatus` to 'generating' → 'done' | 'error'.
   */
  generateEntryAiImages: (id: string) => Promise<void>
  /**
   * Clears the persisted state for a single entry and resets it in-memory to
   * its freshly-parsed sheet state. Exposed for the "Reset entry" button.
   */
  clearEntryState: (id: string) => Promise<void>
  /**
   * Runs the full enhance + bg-removal pipeline for a single entry:
   * enhance product image → remove product bg → enhance logo → remove logo bg.
   * Updates enhanceStatus/enhanceStep on the entry while running.
   */
  enhanceEntry: (id: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// useScheduledBanners
// ---------------------------------------------------------------------------

export function useScheduledBanners(defaultBackground: BackgroundOption | null = null): UseScheduledBannersReturn {
  const [selectedDate, setSelectedDate] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ScheduledBannerEntry[]>([])

  // Keep a ref so resolveEntry always reads the latest defaultBackground
  // without needing to be in its useCallback dependency array.
  const defaultBackgroundRef = useRef<BackgroundOption | null>(defaultBackground)
  useEffect(() => { defaultBackgroundRef.current = defaultBackground }, [defaultBackground])

  const controllerRef = useRef<AbortController | null>(null)

  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const removeBgAbortRef = useRef(false)
  const removeBgInProgressRef = useRef(false)
  const entriesRef = useRef<ScheduledBannerEntry[]>([])

  // Keep track of the date currently loaded so clearEntryState can build the key.
  const selectedDateRef = useRef('')

  // -------------------------------------------------------------------------
  // Persistence helpers (SS-9)
  // -------------------------------------------------------------------------

  /** Extracts the persisted subset from a full ScheduledBannerEntry. */
  function extractPersistedFields(entry: ScheduledBannerEntry): PersistedScheduledEntry {
    return {
      bannerState: entry.bannerState,
      bgRemovedLogoUrl: entry.bgRemovedLogoUrl,
      showBgRemovedLogo: entry.showBgRemovedLogo,
      bgRemovalStatus: entry.bgRemovalStatus,
      aiGenStatus: entry.aiGenStatus,
      enhanceStatus: entry.enhanceStatus,
    }
  }

  /**
   * Persists a single entry by its numeric index in the current entries list.
   * Uses the index (not the entry.id) because the sheet row index is the stable
   * key across page reloads — entry.id embeds the date but not the row offset.
   */
  function persistEntryByIndex(entry: ScheduledBannerEntry, rowIndex: number) {
    void saveScheduledEntry(selectedDateRef.current, rowIndex, extractPersistedFields(entry))
  }

  const syncedSetEntries = useCallback(
    (
      updater: (prev: ScheduledBannerEntry[]) => ScheduledBannerEntry[],
      /** When true, persist the changed entries to IndexedDB after the update. */
      persist = false,
    ) => {
      const prev = entriesRef.current
      const next = updater(prev)
      entriesRef.current = next
      setEntries(next)

      // Persist only entries that actually changed (by reference comparison).
      if (persist) {
        next.forEach((entry, idx) => {
          if (entry !== prev[idx] && entry.status === 'ready') {
            persistEntryByIndex(entry, idx)
          }
        })
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps — persistEntryByIndex is stable
  )

  const resolveEntry = useCallback(
    async (row: SheetRow, id: string, signal: AbortSignal): Promise<void> => {
      const productUrl = row.productUrl
      if (!productUrl) {
        syncedSetEntries(prev =>
          prev.map(e =>
            e.id === id
              ? { ...e, status: 'error', error: 'No product URL found in sheet row' }
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

        const heading = row.heading
        const subheading = row.subheading
        const priceStr = row.price || null

        // Initialise the catalogue image source
        const productImageSources: ImageSource[] = product.imageUrl
          ? [{
              id: 'catalogue',
              label: 'Catalogue',
              originalUrl: product.imageUrl,
              enhancedUrl: null,
              enhancementStatus: 'idle' as const,
              bgRemovedUrl: null,
              bgRemovalStatus: 'idle' as const,
              showBgRemoved: false,
              showOriginal: false,
              source: 'catalogue' as const,
            }]
          : []

        const bannerState: BannerState = {
          ...defaultBannerState(defaultBackgroundRef.current),
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
          quantityStickerText: null,
          showQuantitySticker: false,
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
      selectedDateRef.current = date

      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller

      removeBgAbortRef.current = true

      // Revoke all blob URLs from the departing date's entries
      for (const entry of entriesRef.current) {
        if (entry.bannerState) {
          for (const source of entry.bannerState.productImageSources) {
            if (source.source === 'user' && source.originalUrl.startsWith('blob:')) {
              URL.revokeObjectURL(source.originalUrl)
            }
          }
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
            setFetchError(`No banners scheduled for ${sheetDate}`)
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
            aiGenStatus: 'idle',
            aiGenError: null,
            enhanceStatus: 'idle',
            enhanceStep: '',
          }))

          entriesRef.current = initialEntries
          setEntries(initialEntries)
          setIsFetching(false)

          await Promise.allSettled(
            initialEntries.map(entry => resolveEntry(entry.sheetRow, entry.id, signal)),
          )

          // SS-10: restore persisted states — check IndexedDB for each resolved entry
          // and merge saved data back in so manual edits, bg-removed URLs, and AI gen
          // results are not lost when the same date is re-loaded.
          if (!signal.aborted) {
            const savedResults = await Promise.allSettled(
              entriesRef.current.map((_, idx) => loadScheduledEntry(date, idx)),
            )

            syncedSetEntries(prev =>
              prev.map((entry, idx) => {
                const result = savedResults[idx]
                if (result?.status !== 'fulfilled' || !result.value) return entry

                const saved = result.value
                return {
                  ...entry,
                  bannerState: saved.bannerState ?? entry.bannerState,
                  bgRemovedLogoUrl: saved.bgRemovedLogoUrl,
                  showBgRemovedLogo: saved.showBgRemovedLogo,
                  bgRemovalStatus: saved.bgRemovalStatus,
                  aiGenStatus: saved.aiGenStatus,
                  enhanceStatus: saved.enhanceStatus ?? 'idle',
                }
              }),
            )
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
        true, // persist after manual edit
      )
    },
    [syncedSetEntries],
  )

  const toggleEntryBgRemovedLogo = useCallback(
    (id: string) => {
      syncedSetEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, showBgRemovedLogo: !e.showBgRemovedLogo } : e)),
        true,
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
        true,
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
        true,
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
        if (removeBgAbortRef.current) break
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
          prev.map(e =>
            e.id === id ? { ...e, bgRemovedLogoUrl: logoResultUrl } : e,
          ),
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
      true, // persist completed bg-removal results
    )

    removeBgInProgressRef.current = false
    setIsRemovingBg(false)
  }, [syncedSetEntries]) // stable — reads state via entriesRef

  const generateEntryAiImages = useCallback(async (id: string) => {
    const entry = entriesRef.current.find(e => e.id === id)
    if (!entry || entry.status !== 'ready' || !entry.bannerState) return

    const { bannerState } = entry
    const { selectedProduct } = bannerState
    if (!selectedProduct) return

    syncedSetEntries(prev =>
      prev.map(e => e.id === id ? { ...e, aiGenStatus: 'generating' as const, aiGenError: null } : e),
    )

    try {
      // Step 3 — Logo: resize to fit the brand logo box
      const logoUrl =
        entry.bgRemovedLogoUrl ??
        bannerState.brandLogoOverride ??
        selectedProduct.provider.brandLogo

      if (logoUrl) {
        const resizedDataUrl = await resizeLogoToFit(logoUrl)
        syncedSetEntries(prev =>
          prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return {
              ...e,
              showBgRemovedLogo: false,
              bannerState: { ...e.bannerState, brandLogoOverride: resizedDataUrl },
            }
          }),
        )
      }

      // Step 4 — Product image: re-read entry after logo patch
      const fresh = entriesRef.current.find(e => e.id === id)
      if (!fresh?.bannerState) throw new Error('Entry state lost during AI generation')

      const sourceUrl =
        fresh.bannerState.productImageSources.find(s => s.source === 'catalogue')?.originalUrl ??
        selectedProduct.imageUrl

      if (!sourceUrl) throw new Error('No source image URL available for AI generation')

      const { originalUrl, bgRemovedUrl } = await generateAiProductImage(
        sourceUrl,
        selectedProduct.name,
        selectedProduct.shortDesc,
        selectedProduct.provider.companyName,
      )

      const aiSource: ImageSource = {
        id: 'ai-generated',
        label: 'AI Generated',
        originalUrl,
        enhancedUrl: null,
        enhancementStatus: 'idle',
        bgRemovedUrl,
        bgRemovalStatus: 'done',
        showBgRemoved: true,
        showOriginal: false,
        source: 'ai',
      }

      syncedSetEntries(prev =>
        prev.map(e => {
          if (e.id !== id || !e.bannerState) return e
          const sources = e.bannerState.productImageSources.filter(s => s.id !== 'ai-generated')
          return {
            ...e,
            aiGenStatus: 'done' as const,
            bannerState: {
              ...e.bannerState,
              productImageSources: [...sources, aiSource],
              activeProductImageSourceId: 'ai-generated',
            },
          }
        }),
        true, // persist completed AI gen results
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[generateEntryAiImages] failed for entry', id, '—', message, err)
      syncedSetEntries(prev =>
        prev.map(e =>
          e.id === id ? { ...e, aiGenStatus: 'error' as const, aiGenError: message } : e,
        ),
      )
    }
  }, [syncedSetEntries]) // stable — reads live state via entriesRef

  /**
   * Clears the persisted state for a single entry (SS-10) and resets it
   * in-memory to its most recently resolved sheet state so the user can
   * start fresh without bg-removed or AI-generated overrides.
   */
  const clearEntryState = useCallback(async (id: string) => {
    const idx = entriesRef.current.findIndex(e => e.id === id)
    if (idx === -1) return

    await clearScheduledEntry(selectedDateRef.current, idx)

    // Reset only the persisted overlay fields; leave bannerState intact so the
    // product, heading, subheading etc. from the sheet are still visible.
    syncedSetEntries(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              bgRemovedLogoUrl: null,
              showBgRemovedLogo: true,
              bgRemovalStatus: 'idle' as const,
              bgRemovalError: null,
              aiGenStatus: 'idle' as const,
              aiGenError: null,
              enhanceStatus: 'idle' as const,
              enhanceStep: '',
              bannerState: e.bannerState
                ? {
                    ...e.bannerState,
                    showOriginalLogo: false,
                    productImageSources: e.bannerState.productImageSources
                      .filter(s => s.source !== 'ai')
                      .map(s => ({
                        ...s,
                        bgRemovedUrl: null,
                        bgRemovalStatus: 'idle' as const,
                        showBgRemoved: false,
                        showOriginal: false,
                      })),
                  }
                : null,
            }
          : e,
      ),
    )
  }, [syncedSetEntries, clearScheduledEntry])

  const enhanceEntry = useCallback(async (id: string) => {
    const entry = entriesRef.current.find(e => e.id === id)
    if (!entry || entry.status !== 'ready' || !entry.bannerState) return
    if (entry.enhanceStatus === 'running') return

    const setStep = (enhanceStep: string) =>
      syncedSetEntries(prev => prev.map(e => e.id === id ? { ...e, enhanceStatus: 'running' as const, enhanceStep } : e))

    setStep('Enhancing product image...')

    try {
      const { bannerState } = entry
      const activeSource =
        bannerState.productImageSources.find(s => s.id === bannerState.activeProductImageSourceId) ??
        bannerState.productImageSources[0]

      // Step 1: Enhance product image
      let imageForBgRemoval = activeSource?.originalUrl ?? null
      if (activeSource && activeSource.source !== 'ai') {
        syncedSetEntries(prev => prev.map(e => {
          if (e.id !== id || !e.bannerState) return e
          return { ...e, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
            s.id === activeSource.id ? { ...s, enhancementStatus: 'enhancing' as const } : s
          )}}
        }))
        try {
          const enhancedUrl = await enhanceImage(activeSource.originalUrl)
          syncedSetEntries(prev => prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return { ...e, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
              s.id === activeSource.id ? { ...s, enhancedUrl, enhancementStatus: 'done' as const, showOriginal: false } : s
            )}}
          }))
          imageForBgRemoval = enhancedUrl
        } catch {
          syncedSetEntries(prev => prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return { ...e, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
              s.id === activeSource.id ? { ...s, enhancementStatus: 'error' as const } : s
            )}}
          }))
          // non-fatal: fall through to bg removal with original
        }
      }

      // Step 2: Remove product image background
      if (imageForBgRemoval) {
        setStep('Removing background...')
        syncedSetEntries(prev => prev.map(e => {
          if (e.id !== id || !e.bannerState) return e
          return { ...e, bgRemovalStatus: 'removing' as const, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
            activeSource && s.id === activeSource.id ? { ...s, bgRemovalStatus: 'removing' as const } : s
          )}}
        }))
        try {
          const bgRemovedUrl = await removeBackground(imageForBgRemoval)
          syncedSetEntries(prev => prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return { ...e, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
              activeSource && s.id === activeSource.id
                ? { ...s, bgRemovedUrl, bgRemovalStatus: 'done' as const, showBgRemoved: true }
                : s
            )}}
          }))
        } catch (err) {
          syncedSetEntries(prev => prev.map(e => {
            if (e.id !== id || !e.bannerState) return e
            return { ...e, bannerState: { ...e.bannerState, productImageSources: e.bannerState.productImageSources.map(s =>
              activeSource && s.id === activeSource.id ? { ...s, bgRemovalStatus: 'error' as const } : s
            )}}
          }))
          throw err
        }
      }

      // Steps 3 & 4: Enhance logo then remove its background
      const currentEntry = entriesRef.current.find(e => e.id === id)
      const logoUrl =
        currentEntry?.bannerState?.brandLogoOverride ??
        currentEntry?.bannerState?.selectedProduct?.provider.brandLogo
      if (logoUrl) {
        let logoForBgRemoval = logoUrl
        setStep('Enhancing logo...')
        try {
          logoForBgRemoval = await enhanceImage(logoUrl)
        } catch {
          // non-fatal: bg removal runs on original
        }
        setStep('Removing logo background...')
        const bgRemovedLogoUrl = await removeBackground(logoForBgRemoval)
        syncedSetEntries(prev => prev.map(e =>
          e.id === id ? { ...e, bgRemovedLogoUrl, showBgRemovedLogo: true } : e
        ))
      }

      syncedSetEntries(prev => prev.map(e =>
        e.id === id ? { ...e, bgRemovalStatus: 'done' as const, bgRemovalError: null, enhanceStatus: 'done' as const, enhanceStep: '' } : e
      ), true)
    } catch {
      syncedSetEntries(prev => prev.map(e =>
        e.id === id ? { ...e, enhanceStatus: 'error' as const, enhanceStep: '' } : e
      ))
    }
  }, [syncedSetEntries])

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
    generateEntryAiImages,
    clearEntryState,
    enhanceEntry,
  }
}
