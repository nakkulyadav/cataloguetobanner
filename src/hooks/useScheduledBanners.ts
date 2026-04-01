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
import type { BannerState, ScheduledBannerEntry, SheetRow } from '@/types'

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
    productImageOverride: null,
    logoScale: 1,
    productImageScale: 1,
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
   * all other entry fields untouched. Used by the Edit→Save flow to commit
   * the live BannerContext state back to the scheduled entry.
   */
  updateEntryState: (id: string, state: BannerState) => void
  /**
   * Flips `showBgRemovedProduct` on the matching entry only.
   * No-ops silently when `id` does not match any entry.
   */
  toggleEntryBgRemovedProduct: (id: string) => void
  /**
   * Flips `showBgRemovedLogo` on the matching entry only.
   * No-ops silently when `id` does not match any entry.
   */
  toggleEntryBgRemovedLogo: (id: string) => void
  /**
   * Removes the product-image and brand-logo backgrounds for a single entry.
   *
   * Results are stored in the entry's dedicated fields
   * (`bgRemovedProductImageUrl`, `bgRemovedLogoUrl`) rather than in
   * `bannerState.productImageOverride` / `bannerState.brandLogoOverride`.
   * This decoupling lets users toggle between versions freely (IT-3).
   *
   * Entry transitions: idle/error → removing → done | error.
   * Old blob URLs are revoked before being replaced (leak prevention).
   * No-ops silently if another removal is already in progress.
   */
  removeEntryBackground: (id: string) => Promise<void>
  /** True while any removeEntryBackground call is actively processing */
  isRemovingBg: boolean
}

// ---------------------------------------------------------------------------
// SB-7 to SB-9: useScheduledBanners
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle for the Scheduled Banners feature:
 *
 * 1. User selects a date → `setDate` is called.
 * 2. The hook fetches the Google Sheet and filters rows for that date
 *    (team=bazaar, page=Banner).
 * 3. For each matching row it concurrently calls the Digihaat catalogue API
 *    to resolve the product from the Offer callout URL.
 * 4. On success, it assembles a full `BannerState` with heading/subheading/
 *    price overrides applied from the sheet.
 * 5. Each entry tracks its own loading/ready/error status so the UI can
 *    render partial results as they stream in.
 *
 * Background-removal results are stored in per-entry dedicated fields
 * (`bgRemovedProductImageUrl`, `bgRemovedLogoUrl`) so the user can toggle
 * between original and bg-removed without re-running inference (IT-3).
 */
export function useScheduledBanners(): UseScheduledBannersReturn {
  const [selectedDate, setSelectedDate] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ScheduledBannerEntry[]>([])

  // Track the current abort controller so a new date selection cancels
  // any in-flight requests from the previous selection.
  const controllerRef = useRef<AbortController | null>(null)

  // --- Background removal state ---
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  /**
   * Set to true when the user changes the date while bg removal is in flight.
   * The loop checks this flag between entries and stops early.
   * The WASM model call itself cannot be cancelled mid-inference.
   */
  const removeBgAbortRef = useRef(false)
  /** Guards against concurrent invocations of removeAllBackgrounds. */
  const removeBgInProgressRef = useRef(false)
  /**
   * Mirror of the `entries` state kept in sync via a ref so that
   * removeAllBackgrounds can read the latest value without capturing a stale
   * closure (the function is stable and does not list `entries` as a dep).
   */
  const entriesRef = useRef<ScheduledBannerEntry[]>([])

  /**
   * Wrapper around setEntries that keeps entriesRef in sync.
   * Use this everywhere entries are updated so removeAllBackgrounds always
   * reads the latest state (it reads via entriesRef, not the entries closure).
   */
  const syncedSetEntries = useCallback(
    (updater: (prev: ScheduledBannerEntry[]) => ScheduledBannerEntry[]) => {
      setEntries(prev => {
        const next = updater(prev)
        entriesRef.current = next
        return next
      })
    },
    [],
  )

  /**
   * Resolves a single SheetRow into a ScheduledBannerEntry by:
   *  1. Extracting the product URL from the Offer callout.
   *  2. Calling the catalogue API to fetch the product.
   *  3. Merging price / heading / subheading overrides into BannerState.
   *
   * Updates the entries array in-place via `setEntries` as soon as the
   * result is available (streaming updates, not all-or-nothing).
   */
  const resolveEntry = useCallback(
    async (row: SheetRow, id: string, signal: AbortSignal): Promise<void> => {
      // --- Extract product URL ---
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

      // --- Parse URL params ---
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
        // --- Fetch product from catalogue API ---
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

        // --- Parse sheet overrides ---
        const { heading, subheading } = parseComments(row.comments)
        const priceStr = extractPrice(row.offerCallout)

        // --- Assemble BannerState ---
        const bannerState: BannerState = {
          ...defaultBannerState(),
          selectedProduct: product,
          productNameOverride: heading || null,
          showSubheading: !!subheading,
          subheadingText: subheading,
          priceOverride: priceStr
            ? {
                mrp: product.price?.mrp ?? priceStr,
                sellingPrice: priceStr,
              }
            : null,
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

  /**
   * Called when the user selects a date.
   *
   * `date` is in YYYY-MM-DD format (native `<input type="date">` value).
   * We convert it to MM/DD/YYYY before matching against sheet rows.
   *
   * IT-5: Before clearing entries, revoke any bg-removed blob URLs that were
   * accumulated for the previous date to prevent memory leaks.
   */
  const setDate = useCallback(
    (date: string) => {
      setSelectedDate(date)

      // Cancel any in-flight requests from the previous date selection
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller

      // Signal any in-progress bg removal loop to stop after its current image
      removeBgAbortRef.current = true

      // IT-5: Revoke all bg-removed blob URLs from the departing date's entries
      // before clearing so we don't leave dangling object URLs in memory.
      for (const entry of entriesRef.current) {
        if (entry.bgRemovedProductImageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(entry.bgRemovedProductImageUrl)
        }
        if (entry.bgRemovedLogoUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(entry.bgRemovedLogoUrl)
        }
      }

      // Clear previous results immediately so the UI reflects the new date
      entriesRef.current = []
      setEntries([])
      setFetchError(null)

      if (!date) return

      // Convert YYYY-MM-DD (date input format) → MM/DD/YYYY (sheet format)
      const [y, m, d] = date.split('-')
      const sheetDate = `${m}/${d}/${y}`

      setIsFetching(true)

      // --- Async IIFE: fetch sheet + resolve each row concurrently ---
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

          // IT-2: Initialise all three new fields alongside existing ones so
          // every entry starts with a well-defined bg-toggle state.
          const initialEntries: ScheduledBannerEntry[] = matchedRows.map((row, i) => ({
            id: `sb-${date}-${i}`,
            sheetRow: row,
            status: 'loading',
            bannerState: null,
            error: null,
            bgRemovalStatus: 'idle',
            bgRemovalError: null,
            // IT-2: new fields — null until removeAllBackgrounds() runs
            bgRemovedProductImageUrl: null,
            bgRemovedLogoUrl: null,
            showBgRemovedProduct: true,
            showBgRemovedLogo: true,
          }))

          entriesRef.current = initialEntries
          setEntries(initialEntries)
          setIsFetching(false)

          // Resolve each entry concurrently — updates stream in as they complete
          await Promise.allSettled(
            initialEntries.map(entry => resolveEntry(entry.sheetRow, entry.id, signal)),
          )
        } catch (err) {
          if (signal.aborted) return
          const message = err instanceof Error ? err.message : String(err)
          setFetchError(`Failed to load promotions sheet: ${message}`)
          setIsFetching(false)
        }
      })()
    },
    [resolveEntry],
  )

  /**
   * Patches the `bannerState` of the entry with the given `id` to `state`,
   * leaving every other field on the entry untouched. This is the commit
   * step in the Edit→Save flow (ES-1).
   */
  const updateEntryState = useCallback(
    (id: string, state: BannerState) => {
      syncedSetEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, bannerState: state } : e)),
      )
    },
    [syncedSetEntries],
  )

  const toggleEntryBgRemovedProduct = useCallback(
    (id: string) => {
      syncedSetEntries(prev =>
        prev.map(e => (e.id === id ? { ...e, showBgRemovedProduct: !e.showBgRemovedProduct } : e)),
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

  /**
   * Removes the product-image and brand-logo backgrounds for a single entry.
   * No-ops silently if another removal is already in progress.
   *
   * IT-3: Results stored in dedicated fields, not in bannerState.
   * Old blob URLs are revoked before replacement to prevent memory leaks.
   */
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

    const imageUrl =
      entry.bannerState.productImageOverride ??
      entry.bannerState.selectedProduct?.imageUrl

    if (!imageUrl) {
      removeBgInProgressRef.current = false
      setIsRemovingBg(false)
      return
    }

    // Mark this card as actively processing
    setEntries(prev => {
      const next = prev.map(e =>
        e.id === id ? { ...e, bgRemovalStatus: 'removing' as const } : e,
      )
      entriesRef.current = next
      return next
    })

    try {
      const resultUrl = await removeBackground(imageUrl)

      if (removeBgAbortRef.current) {
        URL.revokeObjectURL(resultUrl)
        removeBgInProgressRef.current = false
        setIsRemovingBg(false)
        return
      }

      setEntries(prev => {
        const next = prev.map(e => {
          if (e.id !== id) return e
          const oldUrl = e.bgRemovedProductImageUrl
          if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
          return { ...e, bgRemovedProductImageUrl: resultUrl }
        })
        entriesRef.current = next
        return next
      })

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

          setEntries(prev => {
            const next = prev.map(e => {
              if (e.id !== id) return e
              const oldLogoUrl = e.bgRemovedLogoUrl
              if (oldLogoUrl?.startsWith('blob:')) URL.revokeObjectURL(oldLogoUrl)
              return { ...e, bgRemovedLogoUrl: logoResultUrl }
            })
            entriesRef.current = next
            return next
          })
        } catch (logoErr) {
          logoError = logoErr instanceof Error ? logoErr.message : String(logoErr)
        }
      }

      setEntries(prev => {
        const next = prev.map(e =>
          e.id === id
            ? {
                ...e,
                bgRemovalStatus: 'done' as const,
                bgRemovalError: logoError ? `Product bg: ok | Logo bg: ${logoError}` : null,
              }
            : e,
        )
        entriesRef.current = next
        return next
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setEntries(prev => {
        const next = prev.map(e =>
          e.id === id
            ? { ...e, bgRemovalStatus: 'error' as const, bgRemovalError: message }
            : e,
        )
        entriesRef.current = next
        return next
      })
    }

    removeBgInProgressRef.current = false
    setIsRemovingBg(false)
  }, []) // stable — reads state via entriesRef, not the entries closure

  return {
    selectedDate,
    setDate,
    isFetching,
    fetchError,
    entries,
    updateEntryState,
    toggleEntryBgRemovedProduct,
    toggleEntryBgRemovedLogo,
    removeEntryBackground,
    isRemovingBg,
  }
}
