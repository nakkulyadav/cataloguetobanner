import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useCatalogue } from '@/hooks/useCatalogue'
import { useBannerState } from '@/hooks/useBannerState'
import { useLogs } from '@/hooks/useLogs'
import { exportBanner, generateFilename } from '@/services/exportService'
import { removeBackground } from '@/services/removeBackgroundService'
import type { ExportFormat } from '@/services/exportService'
import type { BannerState } from '@/types'
import BannerPreview from '@/components/BannerPreview/BannerPreview'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import BannerControls from '@/components/BannerControls/BannerControls'
import ExportPanel from '@/components/ExportPanel/ExportPanel'
import LogsPanel from '@/components/LogsPanel/LogsPanel'

const CATALOGUE_URLS = [
  '/catalogue/bquxjob_3d10dc52_19cae848822.json',
  '/catalogue/bquxjob_29e73a5b_19c9ef4329f.json',
]

function App() {
  const bannerRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // --- Data hooks (Context-based) ---
  const { groups, isLoading, error, missingImageProducts } = useCatalogue(CATALOGUE_URLS)
  const {
    selectedProduct,
    selectedBackground,
    ctaText,
    badgeText,
    showTnc,
    showBadge,
    tncText,
    brandLogoOverride,
    productNameOverride,
    showPrice,
    subheadingText,
    selectProduct,
    selectBackground,
    setCtaText,
    setBadgeText,
    toggleTnc,
    toggleBadge,
    togglePrice,
    setTncText,
    setProductNameOverride,
    priceOverride,
    setPriceOverride,
    setSubheadingText,
  } = useBannerState()
  const { logs, addLog, clearLogs } = useLogs()

  // --- Remove Background state (local to App) ---
  // These blob URLs override the original image URLs in the banner.
  // Kept local because they are ephemeral UI state, not part of BannerState.
  const [bgRemovedProductUrl, setBgRemovedProductUrl] = useState<string | null>(null)
  const [bgRemovedLogoUrl, setBgRemovedLogoUrl] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)

  // Reset processed URLs and revoke blob memory when the selected product changes.
  // This prevents stale blob URLs from leaking when the user switches products.
  useEffect(() => {
    return () => {
      if (bgRemovedProductUrl) URL.revokeObjectURL(bgRemovedProductUrl)
      if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    }
  }, [bgRemovedProductUrl, bgRemovedLogoUrl])

  useEffect(() => {
    // Revoke old blob URLs before resetting
    if (bgRemovedProductUrl) URL.revokeObjectURL(bgRemovedProductUrl)
    if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    setBgRemovedProductUrl(null)
    setBgRemovedLogoUrl(null)
    // Only reset when the product identity changes, not when blob URLs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id])

  // Also reset processed logo when user manually overrides the brand logo,
  // since the override replaces the URL that was processed.
  useEffect(() => {
    if (bgRemovedLogoUrl) {
      URL.revokeObjectURL(bgRemovedLogoUrl)
      setBgRemovedLogoUrl(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLogoOverride])

  /**
   * Calls remove.bg for both the product image and brand logo (if available).
   * Uses Promise.allSettled so one failure doesn't block the other.
   */
  const handleRemoveBackground = useCallback(async () => {
    if (!selectedProduct) return

    const productImageUrl = selectedProduct.imageUrl
    const logoUrl = brandLogoOverride ?? selectedProduct.provider.brandLogo

    // Nothing to process
    if (!productImageUrl && !logoUrl) return

    setIsRemovingBg(true)

    // Build an array of { label, url } for each image that needs processing
    const tasks: Array<{ label: string; url: string }> = []
    if (productImageUrl) tasks.push({ label: 'product image', url: productImageUrl })
    if (logoUrl) tasks.push({ label: 'brand logo', url: logoUrl })

    const results = await Promise.allSettled(
      tasks.map(({ url }) => removeBackground(url)),
    )

    let successCount = 0
    results.forEach((result, i) => {
      const label = tasks[i]?.label ?? 'image'
      if (result.status === 'fulfilled') {
        // Store the blob URL in the appropriate slot
        if (label === 'product image') {
          setBgRemovedProductUrl(result.value)
        } else {
          setBgRemovedLogoUrl(result.value)
        }
        successCount++
      } else {
        const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason)
        addLog('error', `Failed to remove background from ${label}: ${errMsg}`)
      }
    })

    if (successCount > 0) {
      addLog('info', `Background removed from ${successCount} image${successCount > 1 ? 's' : ''}`)
    }

    setIsRemovingBg(false)
  }, [selectedProduct, brandLogoOverride, addLog])

  // Determine if the "Remove Background" button should be disabled:
  // no product, already processing, or both images already processed
  const hasProductImage = !!selectedProduct?.imageUrl
  const hasLogo = !!(brandLogoOverride ?? selectedProduct?.provider.brandLogo)
  const allAlreadyProcessed =
    (!hasProductImage || !!bgRemovedProductUrl) &&
    (!hasLogo || !!bgRemovedLogoUrl)
  const removeBgDisabled = !selectedProduct || isRemovingBg || allAlreadyProcessed

  // Assemble BannerState object for the preview component.
  // Override URLs with background-removed blob URLs when available.
  const bannerState: BannerState = useMemo(() => {
    // Build a product copy with the bg-removed image URL if available
    const effectiveProduct = selectedProduct
      ? {
          ...selectedProduct,
          imageUrl: bgRemovedProductUrl ?? selectedProduct.imageUrl,
        }
      : null

    // Override the brand logo: bg-removed logo > manual override > original
    const effectiveBrandLogo = bgRemovedLogoUrl ?? brandLogoOverride

    return {
      selectedProduct: effectiveProduct,
      selectedBackground,
      ctaText,
      badgeText,
      showTnc,
      showBadge,
      showPrice,
      subheadingText,
      tncText,
      brandLogoOverride: effectiveBrandLogo,
      productNameOverride,
      priceOverride,
    }
  }, [
    selectedProduct,
    selectedBackground,
    ctaText,
    badgeText,
    showTnc,
    showBadge,
    showPrice,
    subheadingText,
    tncText,
    brandLogoOverride,
    productNameOverride,
    priceOverride,
    bgRemovedProductUrl,
    bgRemovedLogoUrl,
  ])

  // Log missing images on catalogue load
  useEffect(() => {
    for (const product of missingImageProducts) {
      addLog('warning', `No product image in the catalogue: "${product.name}"`)
    }
  }, [missingImageProducts, addLog])

  // Log catalogue errors
  useEffect(() => {
    if (error) {
      addLog('error', `Catalogue load failed: ${error}`)
    }
  }, [error, addLog])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!bannerRef.current) return

      setIsExporting(true)
      try {
        const filename = generateFilename(selectedProduct?.name)
        await exportBanner(bannerRef.current, filename, format)
        addLog('info', `Banner exported as ${format.toUpperCase()}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed'
        addLog('error', `Export failed: ${message}`)
      } finally {
        setIsExporting(false)
      }
    },
    [selectedProduct, addLog],
  )

  return (
    <div className="h-screen overflow-hidden bg-[var(--surface-0)] text-[var(--text-primary)] flex">
      {/* Left Sidebar: Export button at top, then Product Search */}
      <aside className="w-64 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--surface-1)]">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h1 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
            Digihaat Banner
          </h1>
        </div>

        {/* Export button — at top of left panel */}
        <div className="border-b border-[var(--border-subtle)]">
          <ExportPanel
            onExport={handleExport}
            isExporting={isExporting}
            disabled={!selectedProduct}
          />
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[var(--text-tertiary)] text-sm">Loading catalogue...</p>
          </div>
        )}

        {error && (
          <div className="p-3">
            <p className="text-[var(--status-error)] text-sm">Failed to load catalogue</p>
          </div>
        )}

        {!isLoading && !error && (
          <ProductSearch
            groups={groups}
            onSelectProduct={selectProduct}
            selectedProductId={selectedProduct?.id ?? null}
          />
        )}
      </aside>

      {/* Main Content: Banner Preview */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--surface-0)]">
        {!selectedProduct ? (
          <div className="text-center flex flex-col items-center gap-4">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[var(--text-disabled)] opacity-50"
            >
              <rect x="4" y="12" width="56" height="40" rx="6" stroke="currentColor" strokeWidth="1.5" />
              <rect x="10" y="20" width="20" height="4" rx="2" fill="currentColor" opacity="0.3" />
              <rect x="10" y="28" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
              <rect x="10" y="36" width="12" height="8" rx="2" fill="currentColor" opacity="0.15" />
              <circle cx="44" cy="32" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
            </svg>
            <div>
              <p className="text-base font-medium text-[var(--text-secondary)] mb-1">
                No product selected
              </p>
              <p className="text-sm text-[var(--text-tertiary)]">
                Pick a product from the sidebar to generate a banner
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-3xl overflow-hidden shadow-deep">
              <BannerPreview ref={bannerRef} state={bannerState} />
            </div>

            {/* Ghost-style "Remove Background" button */}
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={removeBgDisabled}
              className="border border-[var(--border-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] rounded-lg px-4 py-2 text-sm transition-interaction disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isRemovingBg ? 'Removing Background...' : 'Remove Background'}
            </button>

            <p className="text-[10px] text-[var(--text-tertiary)] self-end">722 × 312px</p>
          </div>
        )}
      </main>

      {/* Right Sidebar: Controls + Logs — width 1.25× of w-72 (288→360px) */}
      <aside className="w-[360px] border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-1)]">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
            Banner Settings
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <BannerControls
            ctaText={ctaText}
            badgeText={badgeText}
            showTnc={showTnc}
            showBadge={showBadge}
            tncText={tncText}
            selectedBackgroundId={selectedBackground?.id ?? null}
            productNameOverride={productNameOverride}
            originalProductName={selectedProduct?.name ?? null}
            onCtaChange={setCtaText}
            onBadgeChange={setBadgeText}
            onTncToggle={toggleTnc}
            onBadgeToggle={toggleBadge}
            onTncTextChange={setTncText}
            onBackgroundSelect={selectBackground}
            onProductNameChange={setProductNameOverride}
            showPrice={showPrice}
            onPriceToggle={togglePrice}
            priceOverride={priceOverride}
            originalPrice={selectedProduct?.price}
            onPriceOverrideChange={setPriceOverride}
            subheadingText={subheadingText}
            onSubheadingTextChange={setSubheadingText}
          />
        </div>

        {/* Logs at the bottom */}
        <div className="border-t border-[var(--border-subtle)] h-48">
          <LogsPanel logs={logs} onClear={clearLogs} />
        </div>
      </aside>
    </div>
  )
}

export default App
