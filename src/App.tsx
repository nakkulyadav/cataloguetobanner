import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useBannerState } from '@/hooks/useBannerState'
import { useLogs } from '@/hooks/useLogs'
import { useProviders } from '@/hooks/useProviders'
import { useProviderProducts } from '@/hooks/useProviderProducts'
import { useDirectLookup } from '@/hooks/useDirectLookup'
import { useScheduledBanners } from '@/hooks/useScheduledBanners'
import { exportBanner, generateFilename } from '@/services/exportService'
import { removeBackground } from '@/services/removeBackgroundService'
import type { ExportFormat } from '@/services/exportService'
import type { BannerState, ApiProvider, ProductGroup, ParsedProduct, ScheduledBannerEntry } from '@/types'
import BannerPreview from '@/components/BannerPreview/BannerPreview'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import ProviderSearch from '@/components/ProviderSearch/ProviderSearch'
import DirectLookup from '@/components/DirectLookup/DirectLookup'
import BannerControls from '@/components/BannerControls/BannerControls'
import ExportPanel from '@/components/ExportPanel/ExportPanel'
import LogsPanel from '@/components/LogsPanel/LogsPanel'
import ScheduledBannersGrid from '@/components/DateSchedule/ScheduledBannersGrid'
import CalendarPicker from '@/components/DateSchedule/CalendarPicker'

/** Top-level mode toggle: single product builder vs. date-based batch scheduler */
type AppMode = 'builder' | 'scheduled'

function App() {
  const bannerRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // --- Top-level mode: banner builder vs. scheduled banners ---
  const [appMode, setAppMode] = useState<AppMode>('builder')

  // Scheduled banners hook — manages sheet fetch + per-banner state
  const scheduledBanners = useScheduledBanners()

  // --- Provider selection state (two-step browse flow) ---
  const [selectedBpp, setSelectedBpp] = useState<string | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [providerSearch, setProviderSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null)

  // --- API data hooks ---
  const { providers, isLoading: providersLoading, error: providersError, hasMore: providersHasMore, loadMore: loadMoreProviders } = useProviders(selectedBpp, selectedDomain, providerSearch)
  const { groups, isLoading: productsLoading, error: productsError, missingImageProducts, hasMore: productsHasMore, loadMore: loadMoreProducts } = useProviderProducts(selectedProvider?.id ?? null)

  // --- Direct lookup (bypass BPP > Domain > Provider flow) ---
  const directLookup = useDirectLookup()

  // --- Banner state (Context-based) ---
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
    showLogo,
    showHeading,
    showCta,
    showSubheading,
    subheadingText,
    productImageOverride,
    selectProduct,
    selectBackground,
    setCtaText,
    setBadgeText,
    toggleTnc,
    toggleBadge,
    togglePrice,
    toggleLogo,
    toggleHeading,
    toggleCta,
    toggleSubheading,
    setTncText,
    setProductNameOverride,
    setBrandLogoOverride,
    setProductImageOverride,
    priceOverride,
    setPriceOverride,
    setSubheadingText,
    logoScale,
    productImageScale,
    setLogoScale,
    setProductImageScale,
    loadState,
  } = useBannerState()
  const { logs, addLog, clearLogs } = useLogs()

  // --- Scheduled banner editing ---
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null)
  const editingScheduledEntry = editingScheduledId
    ? scheduledBanners.entries.find(e => e.id === editingScheduledId) ?? null
    : null

  const handleEditScheduledEntry = useCallback(
    (entry: ScheduledBannerEntry) => {
      if (!entry.bannerState) return
      loadState(entry.bannerState)
      setEditingScheduledId(entry.id)
    },
    [loadState],
  )

  // --- Provider selection handlers (browse flow) ---
  const handleSelectProvider = useCallback((provider: ApiProvider) => {
    setSelectedProvider(provider)
  }, [])

  const handleBackToProviders = useCallback(() => {
    setSelectedProvider(null)
    selectProduct(null)
  }, [selectProduct])

  // --- Direct lookup handlers ---
  const handleDirectLookupProvider = useCallback(async (providerId: string) => {
    // Clear browse-mode selection so the UI switches to lookup results
    setSelectedProvider(null)
    selectProduct(null)
    await directLookup.lookupProvider(providerId)
  }, [directLookup, selectProduct])

  const handleDirectLookupUrl = useCallback(async (url: string) => {
    // Clear browse-mode selection
    setSelectedProvider(null)
    await directLookup.lookupByUrl(url)
  }, [directLookup])

  const handleDirectLookupClear = useCallback(() => {
    directLookup.clear()
    selectProduct(null)
  }, [directLookup, selectProduct])

  // Auto-select product when item lookup completes
  useEffect(() => {
    if (directLookup.itemResult?.product) {
      selectProduct(directLookup.itemResult.product)
    }
  }, [directLookup.itemResult, selectProduct])

  /**
   * Determine which data source to use for the product list.
   * Direct lookup results override the browse-flow data when active.
   */
  const activeGroups: ProductGroup[] = directLookup.providerResult
    ? directLookup.providerResult.groups
    : groups
  const activeProductsLoading: boolean = directLookup.isLoading || productsLoading
  const activeMissingImageProducts: ParsedProduct[] = directLookup.providerResult
    ? directLookup.providerResult.missingImageProducts
    : missingImageProducts
  // Name shown in the ProductSearch header when in direct-lookup provider mode
  const activeProviderName = directLookup.providerResult?.provider?.name
    ?? selectedProvider?.name

  // --- Remove Background state (local to App) ---
  const [bgRemovedProductUrl, setBgRemovedProductUrl] = useState<string | null>(null)
  const [bgRemovedLogoUrl, setBgRemovedLogoUrl] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)

  /**
   * IT-6: Per-image toggle flags — whether to display the bg-removed version.
   * Defaults to false (show original). Flipped to true automatically after
   * a successful removal call, and reset to false when the source image changes
   * (product switch, upload override change).
   */
  const [showBgRemovedProduct, setShowBgRemovedProduct] = useState(false)
  const [showBgRemovedLogo, setShowBgRemovedLogo] = useState(false)

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (bgRemovedProductUrl) URL.revokeObjectURL(bgRemovedProductUrl)
      if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    }
  }, [bgRemovedProductUrl, bgRemovedLogoUrl])

  // Reset processed URLs when selected product changes (IT-7: also reset toggle flags)
  useEffect(() => {
    if (bgRemovedProductUrl) URL.revokeObjectURL(bgRemovedProductUrl)
    if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    setBgRemovedProductUrl(null)
    setBgRemovedLogoUrl(null)
    // IT-7: hide toggle buttons when the product changes
    setShowBgRemovedProduct(false)
    setShowBgRemovedLogo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id])

  // Reset processed logo when brand logo override changes (IT-7)
  useEffect(() => {
    if (bgRemovedLogoUrl) {
      URL.revokeObjectURL(bgRemovedLogoUrl)
      setBgRemovedLogoUrl(null)
    }
    // IT-7: hide logo toggle when the source image changes
    setShowBgRemovedLogo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLogoOverride])

  // Reset processed product image when product image override changes (IT-7)
  useEffect(() => {
    if (bgRemovedProductUrl) {
      URL.revokeObjectURL(bgRemovedProductUrl)
      setBgRemovedProductUrl(null)
    }
    // IT-7: hide product toggle when the source image changes
    setShowBgRemovedProduct(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productImageOverride])

  /**
   * Calls remove.bg for both the product image and brand logo (if available).
   * Uses Promise.allSettled so one failure doesn't block the other.
   */
  const handleRemoveBackground = useCallback(async () => {
    if (!selectedProduct) return

    const productImageUrl = productImageOverride ?? selectedProduct.imageUrl
    const logoUrl = brandLogoOverride ?? selectedProduct.provider.brandLogo

    if (!productImageUrl && !logoUrl) return

    setIsRemovingBg(true)

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
        if (label === 'product image') {
          setBgRemovedProductUrl(result.value)
          // IT-6: auto-flip toggle to "BG Removed" on success so the result
          // is immediately visible without a manual click
          setShowBgRemovedProduct(true)
        } else {
          setBgRemovedLogoUrl(result.value)
          // IT-6: same auto-flip for the logo
          setShowBgRemovedLogo(true)
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
  }, [selectedProduct, brandLogoOverride, productImageOverride, addLog])

  // Remove Background button disabled state
  const hasProductImage = !!(productImageOverride ?? selectedProduct?.imageUrl)
  const hasLogo = !!(brandLogoOverride ?? selectedProduct?.provider.brandLogo)
  const allAlreadyProcessed =
    (!hasProductImage || !!bgRemovedProductUrl) &&
    (!hasLogo || !!bgRemovedLogoUrl)
  const removeBgDisabled = !selectedProduct || isRemovingBg || allAlreadyProcessed

  // Assemble BannerState for the preview component.
  //
  // IT-8: The toggle flags (showBgRemovedProduct / showBgRemovedLogo) control
  // which image version is injected into the preview. When a toggle is ON and a
  // bg-removed blob URL exists, that URL is used; otherwise the original source
  // (user upload override or catalogue image) is shown.
  //
  // Injection is done via productImageOverride / brandLogoOverride so that
  // BannerPreview's existing priority chain (override > catalogue) is respected
  // regardless of whether the user has also uploaded a custom image.
  const bannerState: BannerState = useMemo(() => {
    // Product image: if toggle ON and blob ready → show bg-removed; else original
    const effectiveProductImageOverride =
      (showBgRemovedProduct && bgRemovedProductUrl)
        ? bgRemovedProductUrl
        : productImageOverride

    // Brand logo: if toggle ON and blob ready → show bg-removed; else original
    const effectiveBrandLogo =
      (showBgRemovedLogo && bgRemovedLogoUrl)
        ? bgRemovedLogoUrl
        : brandLogoOverride

    return {
      selectedProduct,
      selectedBackground,
      ctaText,
      badgeText,
      showTnc,
      showBadge,
      showPrice,
      showLogo,
      showHeading,
      showCta,
      showSubheading,
      subheadingText,
      tncText,
      brandLogoOverride: effectiveBrandLogo,
      productNameOverride,
      priceOverride,
      productImageOverride: effectiveProductImageOverride,
      logoScale,
      productImageScale,
    }
  }, [
    selectedProduct,
    selectedBackground,
    ctaText,
    badgeText,
    showTnc,
    showBadge,
    showPrice,
    showLogo,
    showHeading,
    showCta,
    showSubheading,
    subheadingText,
    tncText,
    brandLogoOverride,
    productNameOverride,
    priceOverride,
    productImageOverride,
    bgRemovedProductUrl,
    bgRemovedLogoUrl,
    showBgRemovedProduct,
    showBgRemovedLogo,
    logoScale,
    productImageScale,
  ])

  /**
   * Commits the current BannerContext state back to the scheduled entry being
   * edited, then clears the editing selection. Called when the user clicks
   * "Save" on a scheduled banner card (ES-2).
   *
   * `bannerState` is safe to reference here — this callback is declared after
   * the `bannerState` useMemo above.
   */
  const handleSaveScheduledEntry = useCallback(() => {
    if (!editingScheduledId) return
    scheduledBanners.updateEntryState(editingScheduledId, bannerState)
    setEditingScheduledId(null)
  }, [editingScheduledId, scheduledBanners, bannerState])

  // Log missing images when products load (uses active data source)
  useEffect(() => {
    for (const product of activeMissingImageProducts) {
      addLog('warning', `No product image in the catalogue: "${product.name}"`)
    }
  }, [activeMissingImageProducts, addLog])

  // Log missing price data summary (uses active data source)
  useEffect(() => {
    if (activeGroups.length > 0) {
      const allProducts = activeGroups.flatMap(g => [g.parent, ...g.children])
      const missingPriceCount = allProducts.filter(p => !p.price).length
      if (missingPriceCount > 0) {
        addLog('info', `Price data missing for ${missingPriceCount} product${missingPriceCount > 1 ? 's' : ''}`)
      }
    }
  }, [activeGroups, addLog])

  // Log API errors
  useEffect(() => {
    if (productsError) {
      addLog('error', `Failed to load products: ${productsError}`)
    }
  }, [productsError, addLog])

  useEffect(() => {
    if (providersError) {
      addLog('error', `Failed to load providers: ${providersError}`)
    }
  }, [providersError, addLog])

  useEffect(() => {
    if (directLookup.error) {
      addLog('error', `Direct lookup failed: ${directLookup.error}`)
    }
  }, [directLookup.error, addLog])

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

  /**
   * Whether to show the product list (direct lookup provider result or browse-mode provider).
   * Item lookup auto-selects — no product list needed.
   */
  const showProductList = directLookup.providerResult !== null || selectedProvider !== null

  /**
   * "Back to providers" handler for the product list.
   * If in direct-lookup mode, "back" clears the lookup entirely.
   * If in browse mode, it deselects the provider.
   */
  const handleProductListBack = directLookup.providerResult
    ? handleDirectLookupClear
    : handleBackToProviders

  return (
    <div className="h-screen overflow-hidden bg-[var(--surface-0)] text-[var(--text-primary)] flex">
      {/* Left Sidebar: Export + Direct Lookup + Provider/Product Search */}
      <aside className="w-64 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--surface-1)]">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex flex-col gap-2">
          <h1 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
            Digihaat Banner
          </h1>

          {/* Mode tabs: Builder vs. Scheduled */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-subtle)] text-[11px] font-medium">
            <button
              onClick={() => { setAppMode('builder'); setEditingScheduledId(null) }}
              className={`flex-1 py-1.5 transition-interaction cursor-pointer ${
                appMode === 'builder'
                  ? 'bg-[var(--accent-base)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Builder
            </button>
            <button
              onClick={() => setAppMode('scheduled')}
              className={`flex-1 py-1.5 transition-interaction cursor-pointer ${
                appMode === 'scheduled'
                  ? 'bg-[var(--accent-base)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Scheduled
            </button>
          </div>
        </div>


        {/* Scheduled-mode: calendar picker */}
        {appMode === 'scheduled' && (
          <div className="border-b border-[var(--border-subtle)]">
            <CalendarPicker
              value={scheduledBanners.selectedDate}
              onChange={(date) => {
                setEditingScheduledId(null)
                scheduledBanners.setDate(date)
              }}
            />
          </div>
        )}

        {/* Builder-only sidebar controls */}
        {appMode === 'builder' && (<>

        {/* Export button */}
        <div className="border-b border-[var(--border-subtle)]">
          <ExportPanel
            onExport={handleExport}
            isExporting={isExporting}
            disabled={!selectedProduct}
          />
        </div>

        {/* Direct Lookup section — always visible at top of sidebar */}
        <DirectLookup
          isActive={directLookup.isActive}
          isLoading={directLookup.isLoading}
          error={directLookup.error}
          onLookupProvider={handleDirectLookupProvider}
          onLookupByUrl={handleDirectLookupUrl}
          onClear={handleDirectLookupClear}
        />

        {/* Product list (from direct lookup provider result or browse-mode provider) */}
        {showProductList ? (
          <ProductSearch
            groups={activeGroups}
            onSelectProduct={selectProduct}
            selectedProductId={selectedProduct?.id ?? null}
            selectedProviderName={activeProviderName}
            onBackToProviders={handleProductListBack}
            isLoading={activeProductsLoading}
            hasMore={directLookup.providerResult ? false : productsHasMore}
            onLoadMore={loadMoreProducts}
          />
        ) : !directLookup.isActive ? (
          /* Browse flow: BPP > Domain > Provider selection */
          <ProviderSearch
            providers={providers}
            isLoading={providersLoading}
            error={providersError}
            bppId={selectedBpp}
            domain={selectedDomain}
            providerSearch={providerSearch}
            onBppChange={setSelectedBpp}
            onDomainChange={setSelectedDomain}
            onProviderSearchChange={setProviderSearch}
            onSelectProvider={handleSelectProvider}
            hasMore={providersHasMore}
            onLoadMore={loadMoreProviders}
          />
        ) : null}

        {/* End builder-only sidebar controls */}
        </>)}
      </aside>

      {/* Main Content: Banner Preview (builder) or Scheduled grid */}
      <main className={`flex-1 flex flex-col bg-[var(--surface-0)] ${appMode === 'builder' ? 'items-center justify-center p-8' : 'overflow-hidden'}`}>
        {/* Scheduled banners mode — full-height scrollable grid */}
        {appMode === 'scheduled' && (
          <ScheduledBannersGrid
            selectedDate={scheduledBanners.selectedDate}
            isFetching={scheduledBanners.isFetching}
            fetchError={scheduledBanners.fetchError}
            entries={scheduledBanners.entries}
            editingId={editingScheduledId}
            onEditEntry={handleEditScheduledEntry}
            onSaveEntry={handleSaveScheduledEntry}
            editingBannerState={editingScheduledId ? bannerState : null}
            onRemoveBgEntry={scheduledBanners.removeEntryBackground}
            isRemovingBg={scheduledBanners.isRemovingBg}
          />
        )}

        {/* Builder mode — single product preview */}
        {appMode === 'builder' && (!selectedProduct ? (
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
        ))}
      </main>

      {/* Right Sidebar: Controls + Logs */}
      <aside className="w-[360px] border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-1)]">
        {appMode === 'scheduled' && !editingScheduledId ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-[var(--text-tertiary)] text-center leading-relaxed">
              Click <span className="font-medium text-[var(--text-secondary)]">Edit</span> on a banner to configure its settings
            </p>
          </div>
        ) : (
          <>
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
            showSubheading={showSubheading}
            onSubheadingToggle={toggleSubheading}
            showLogo={showLogo}
            onLogoToggle={toggleLogo}
            showHeading={showHeading}
            onHeadingToggle={toggleHeading}
            showCta={showCta}
            onCtaToggle={toggleCta}
            brandLogoOverride={brandLogoOverride}
            onBrandLogoChange={setBrandLogoOverride}
            logoScale={logoScale}
            onLogoScaleChange={setLogoScale}
            productImageOverride={productImageOverride}
            onProductImageChange={setProductImageOverride}
            productImageScale={productImageScale}
            onProductImageScaleChange={setProductImageScale}
            // bg-version toggle props: use editing scheduled entry when in scheduled mode
            hasBgRemovedProduct={editingScheduledEntry
              ? !!editingScheduledEntry.bgRemovedProductImageUrl
              : !!bgRemovedProductUrl}
            showBgRemovedProduct={editingScheduledEntry
              ? editingScheduledEntry.showBgRemovedProduct
              : showBgRemovedProduct}
            onToggleBgRemovedProduct={editingScheduledEntry
              ? () => scheduledBanners.toggleEntryBgRemovedProduct(editingScheduledEntry.id)
              : () => setShowBgRemovedProduct(p => !p)}
            hasBgRemovedLogo={editingScheduledEntry
              ? !!editingScheduledEntry.bgRemovedLogoUrl
              : !!bgRemovedLogoUrl}
            showBgRemovedLogo={editingScheduledEntry
              ? editingScheduledEntry.showBgRemovedLogo
              : showBgRemovedLogo}
            onToggleBgRemovedLogo={editingScheduledEntry
              ? () => scheduledBanners.toggleEntryBgRemovedLogo(editingScheduledEntry.id)
              : () => setShowBgRemovedLogo(p => !p)}
            />
            </div>
          </>
        )}

        {/* Logs at the bottom */}
        <div className="border-t border-[var(--border-subtle)] h-48">
          <LogsPanel logs={logs} onClear={clearLogs} />
        </div>
      </aside>
    </div>
  )
}

export default App
