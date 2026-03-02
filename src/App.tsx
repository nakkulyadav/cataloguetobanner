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

const CATALOGUE_URL = '/catalogue/bquxjob_29e73a5b_19c9ef4329f.json'

function App() {
  const bannerRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // --- Data hooks (Context-based) ---
  const { groups, isLoading, error, missingImageProducts } = useCatalogue(CATALOGUE_URL)
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
    selectProduct,
    selectBackground,
    setCtaText,
    setBadgeText,
    toggleTnc,
    toggleBadge,
    setTncText,
    setBrandLogoOverride,
    setProductNameOverride,
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
      tncText,
      brandLogoOverride: effectiveBrandLogo,
      productNameOverride,
    }
  }, [
    selectedProduct,
    selectedBackground,
    ctaText,
    badgeText,
    showTnc,
    showBadge,
    tncText,
    brandLogoOverride,
    productNameOverride,
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
    <div className="h-screen overflow-hidden bg-gray-950 text-gray-100 flex">
      {/* Left Sidebar: Product Search */}
      <aside className="w-72 border-r border-gray-800 flex flex-col bg-gray-950">
        <div className="px-4 py-3 border-b border-gray-800">
          <h1 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
            Digihaat Banner
          </h1>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Loading catalogue...</p>
          </div>
        )}

        {error && (
          <div className="p-3">
            <p className="text-red-400 text-sm">Failed to load catalogue</p>
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
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-900/50">
        {!selectedProduct ? (
          <div className="text-gray-500 text-center">
            <p className="text-lg mb-1">Select a product to get started</p>
            <p className="text-sm">Choose a product from the sidebar to preview the banner</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg overflow-hidden shadow-2xl border border-gray-700">
              <BannerPreview ref={bannerRef} state={bannerState} />
            </div>

            {/* Remove Background button — sits between preview and dimension label */}
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={removeBgDisabled}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRemovingBg ? 'Removing Background...' : 'Remove Background'}
            </button>

            <p className="text-xs text-gray-500">722 × 312px</p>
          </div>
        )}
      </main>

      {/* Right Sidebar: Controls + Export + Logs */}
      <aside className="w-80 border-l border-gray-800 flex flex-col bg-gray-950">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
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
            brandLogoOverride={brandLogoOverride}
            productNameOverride={productNameOverride}
            originalProductName={selectedProduct?.name ?? null}
            onCtaChange={setCtaText}
            onBadgeChange={setBadgeText}
            onTncToggle={toggleTnc}
            onBadgeToggle={toggleBadge}
            onTncTextChange={setTncText}
            onBackgroundSelect={selectBackground}
            onBrandLogoOverride={setBrandLogoOverride}
            onProductNameChange={setProductNameOverride}
          />

          <div className="border-t border-gray-800">
            <ExportPanel
              onExport={handleExport}
              isExporting={isExporting}
              disabled={!selectedProduct}
            />
          </div>
        </div>

        {/* Logs at the bottom */}
        <div className="border-t border-gray-800 h-48">
          <LogsPanel logs={logs} onClear={clearLogs} />
        </div>
      </aside>
    </div>
  )
}

export default App
