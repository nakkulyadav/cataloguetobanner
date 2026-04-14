import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useBannerState } from '@/hooks/useBannerState'
import { useLogs } from '@/hooks/useLogs'
import { useProviders } from '@/hooks/useProviders'
import { useProviderProducts } from '@/hooks/useProviderProducts'
import { useDirectLookup } from '@/hooks/useDirectLookup'
import { useScheduledBanners } from '@/hooks/useScheduledBanners'
import { useBackgrounds } from '@/hooks/useBackgrounds'
import { exportBanner, generateFilename } from '@/services/exportService'
import { removeBackground } from '@/services/removeBackgroundService'
import { translateFields, SUPPORTED_LANGUAGES } from '@/services/translationService'
import type { ExportFormat } from '@/services/exportService'
import type { LanguageCode } from '@/services/translationService'
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
  const [isTranslating, setIsTranslating] = useState(false)
  // Per-field English source captured at translation time.
  // On re-translate, these are used instead of the (possibly translated) field values
  // so we always translate from English. Cleared per-field when the user manually edits.
  const [englishSources, setEnglishSources] = useState<import('@/services/translationService').TranslatableFields>({})

  // --- Top-level mode: banner builder vs. scheduled banners ---
  const [appMode, setAppMode] = useState<AppMode>('builder')

  // --- Backgrounds from Google Sheet ---
  const { backgrounds, defaultBackground } = useBackgrounds()

  // Scheduled banners hook — receives the default background so scheduled entries use it
  const scheduledBanners = useScheduledBanners(defaultBackground)

  // Set the default background once it loads (only if none is selected yet)
  useEffect(() => {
    if (defaultBackground && !selectedBackground) {
      selectBackground(defaultBackground)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBackground])

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
    productImageSources,
    activeProductImageSourceId,
    logoImageSources,
    activeLogoImageSourceId,
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
    addProductImageSource,
    removeProductImageSource,
    setActiveProductImageSource,
    updateProductImageSourceBg,
    toggleSourceBgRemoved,
    priceOverride,
    setPriceOverride,
    setSubheadingText,
    logoScale,
    productImageScale,
    setLogoScale,
    setProductImageScale,
    quantityStickerText,
    showQuantitySticker,
    toggleQuantitySticker,
    setQuantityStickerText,
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

  // --- Logo bg removal state (unchanged from before) ---
  const [bgRemovedLogoUrl, setBgRemovedLogoUrl] = useState<string | null>(null)
  const [showBgRemovedLogo, setShowBgRemovedLogo] = useState(false)

  // Clean up logo blob URL on unmount
  useEffect(() => {
    return () => {
      if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    }
  }, [bgRemovedLogoUrl])

  // Reset logo bg state when selected product changes
  useEffect(() => {
    if (bgRemovedLogoUrl) URL.revokeObjectURL(bgRemovedLogoUrl)
    setBgRemovedLogoUrl(null)
    setShowBgRemovedLogo(false)
    setEnglishSources({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id])

  // Reset logo bg state when brand logo override changes
  useEffect(() => {
    if (bgRemovedLogoUrl) {
      URL.revokeObjectURL(bgRemovedLogoUrl)
      setBgRemovedLogoUrl(null)
    }
    setShowBgRemovedLogo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLogoOverride])

  // --- Per-source bg removal ---
  const runBgRemovalForSource = useCallback(async (sourceId: string, sourceUrl: string) => {
    updateProductImageSourceBg(sourceId, { bgRemovedUrl: null, bgRemovalStatus: 'removing', showBgRemoved: false })
    try {
      const resultUrl = await removeBackground(sourceUrl)
      updateProductImageSourceBg(sourceId, {
        bgRemovedUrl: resultUrl,
        bgRemovalStatus: 'done',
        showBgRemoved: true,
      })
    } catch (err) {
      updateProductImageSourceBg(sourceId, { bgRemovedUrl: null, bgRemovalStatus: 'error', showBgRemoved: false })
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Failed to remove background: ${msg}`)
    }
  }, [updateProductImageSourceBg, addLog])

  // Auto-trigger bg removal for any newly-added idle source
  useEffect(() => {
    for (const source of productImageSources) {
      if (source.bgRemovalStatus === 'idle') {
        void runBgRemovalForSource(source.id, source.originalUrl)
      }
    }
  }, [productImageSources, runBgRemovalForSource])

  // --- Logo bg removal (triggered once when product loads) ---
  const handleRemoveLogoBackground = useCallback(async () => {
    const logoUrl = brandLogoOverride ?? selectedProduct?.provider.brandLogo
    if (!logoUrl) return
    try {
      const resultUrl = await removeBackground(logoUrl)
      setBgRemovedLogoUrl(resultUrl)
      setShowBgRemovedLogo(true)
      addLog('info', 'Background removed from brand logo')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Failed to remove background from brand logo: ${msg}`)
    }
  }, [brandLogoOverride, selectedProduct, addLog])

  // Auto-trigger logo removal when a product is selected
  useEffect(() => {
    if (selectedProduct) {
      void handleRemoveLogoBackground()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id])

  // Derived: is any source currently being processed?
  const isRemovingBg = productImageSources.some(s => s.bgRemovalStatus === 'removing')

  // Handler called from BannerControls when user uploads/pastes a product image
  const handleAddProductImage = useCallback((url: string) => {
    addProductImageSource(url)
    // The useEffect above picks up the new 'idle' source and triggers removal
  }, [addProductImageSource])

  // Assemble BannerState for the preview component.
  // Logo bg state is injected via brandLogoOverride; product image is derived
  // inside BannerPreview from productImageSources + activeProductImageSourceId.
  const bannerState: BannerState = useMemo(() => {
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
      productImageSources,
      activeProductImageSourceId,
      logoImageSources,
      activeLogoImageSourceId,
      logoScale,
      productImageScale,
      quantityStickerText,
      showQuantitySticker,
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
    productImageSources,
    activeProductImageSourceId,
    bgRemovedLogoUrl,
    showBgRemovedLogo,
    logoScale,
    productImageScale,
    quantityStickerText,
    showQuantitySticker,
  ])

  /**
   * Commits the current BannerContext state back to the scheduled entry being
   * edited, then clears the editing selection.
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

  // Wrappers for manual field edits — clear the stored English source for that field
  // so the next translation uses the new manually-entered value as the source.
  const handleProductNameChange = useCallback((name: string | null) => {
    setProductNameOverride(name)
    setEnglishSources(prev => ({ ...prev, productName: undefined }))
  }, [setProductNameOverride])

  const handleSubheadingChange = useCallback((text: string) => {
    setSubheadingText(text)
    setEnglishSources(prev => ({ ...prev, subheading: undefined }))
  }, [setSubheadingText])

  const handleCtaChange = useCallback((text: string) => {
    setCtaText(text)
    setEnglishSources(prev => ({ ...prev, cta: undefined }))
  }, [setCtaText])

  const handleBadgeChange = useCallback((text: string) => {
    setBadgeText(text)
    setEnglishSources(prev => ({ ...prev, badge: undefined }))
  }, [setBadgeText])

  const handleTranslateAll = useCallback(async (langCode: LanguageCode) => {
    // Resolve source for each field: stored English source takes priority over current value
    // so we always translate from English, never from a previous translation.
    const sources = {
      productName: englishSources.productName ?? (productNameOverride ?? selectedProduct?.name) ?? undefined,
      subheading: englishSources.subheading ?? subheadingText ?? undefined,
      cta: englishSources.cta ?? ctaText ?? undefined,
      badge: englishSources.badge ?? badgeText ?? undefined,
    }

    if (langCode === 'en') {
      // Restore to English from stored sources (no API call needed)
      if (sources.productName) setProductNameOverride(sources.productName)
      if (sources.subheading) setSubheadingText(sources.subheading)
      if (sources.cta) setCtaText(sources.cta)
      if (sources.badge) setBadgeText(sources.badge)
      setEnglishSources({})
      addLog('info', 'Restored fields to English')
      return
    }

    setIsTranslating(true)
    try {
      // Persist these as the English sources before translating
      setEnglishSources(sources)

      const { results, errors } = await translateFields(sources, langCode)

      if (results.productName !== undefined) setProductNameOverride(results.productName)
      if (results.subheading !== undefined) setSubheadingText(results.subheading)
      if (results.cta !== undefined) setCtaText(results.cta)
      if (results.badge !== undefined) setBadgeText(results.badge)

      const successCount = Object.keys(results).length
      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.label ?? langCode
      if (successCount > 0) {
        addLog('info', `Translated ${successCount} field${successCount > 1 ? 's' : ''} to ${langLabel}`)
      }
      for (const error of errors) {
        addLog('error', `Translation failed — ${error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Translation failed: ${msg}`)
    } finally {
      setIsTranslating(false)
    }
  }, [
    englishSources,
    productNameOverride, selectedProduct,
    subheadingText, ctaText, badgeText,
    setProductNameOverride, setSubheadingText, setCtaText, setBadgeText,
    addLog,
  ])

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
              <BannerPreview ref={bannerRef} state={bannerState} isRemovingBg={isRemovingBg} />
            </div>

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
            backgrounds={backgrounds}
            selectedBackgroundId={selectedBackground?.id ?? null}
            productNameOverride={productNameOverride}
            originalProductName={selectedProduct?.name ?? null}
            onCtaChange={handleCtaChange}
            onBadgeChange={handleBadgeChange}
            onTncToggle={toggleTnc}
            onBadgeToggle={toggleBadge}
            onTncTextChange={setTncText}
            onBackgroundSelect={selectBackground}
            onProductNameChange={handleProductNameChange}
            showPrice={showPrice}
            onPriceToggle={togglePrice}
            priceOverride={priceOverride}
            originalPrice={selectedProduct?.price}
            onPriceOverrideChange={setPriceOverride}
            subheadingText={subheadingText}
            onSubheadingTextChange={handleSubheadingChange}
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
            productImageScale={productImageScale}
            onProductImageScaleChange={setProductImageScale}
            productImageSources={editingScheduledEntry
              ? (editingScheduledEntry.bannerState?.productImageSources ?? productImageSources)
              : productImageSources}
            activeProductImageSourceId={editingScheduledEntry
              ? (editingScheduledEntry.bannerState?.activeProductImageSourceId ?? activeProductImageSourceId)
              : activeProductImageSourceId}
            onAddProductImage={handleAddProductImage}
            onRemoveProductImageSource={removeProductImageSource}
            onSelectProductImageSource={editingScheduledEntry
              ? (id) => scheduledBanners.setEntryActiveSource(editingScheduledEntry.id, id)
              : setActiveProductImageSource}
            onToggleSourceBgRemoved={editingScheduledEntry
              ? (id) => scheduledBanners.toggleEntrySourceBgRemoved(editingScheduledEntry.id, id)
              : toggleSourceBgRemoved}
            hasBgRemovedLogo={editingScheduledEntry
              ? !!editingScheduledEntry.bgRemovedLogoUrl
              : !!bgRemovedLogoUrl}
            showBgRemovedLogo={editingScheduledEntry
              ? editingScheduledEntry.showBgRemovedLogo
              : showBgRemovedLogo}
            onToggleBgRemovedLogo={editingScheduledEntry
              ? () => scheduledBanners.toggleEntryBgRemovedLogo(editingScheduledEntry.id)
              : () => setShowBgRemovedLogo(p => !p)}
            showQuantitySticker={showQuantitySticker}
            onQuantityStickerToggle={toggleQuantitySticker}
            quantityStickerText={quantityStickerText}
            onQuantityStickerTextChange={setQuantityStickerText}
            onTranslateAll={handleTranslateAll}
            isTranslating={isTranslating}
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
