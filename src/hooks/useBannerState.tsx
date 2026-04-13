import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BannerState, ParsedProduct, BackgroundOption, ProductPrice, ImageSource } from '../types';

interface BannerContextType extends BannerState {
  toggleQuantitySticker: () => void;
  setQuantityStickerText: (text: string | null) => void;
  selectProduct: (product: ParsedProduct | null) => void;
  selectBackground: (bg: BackgroundOption | null) => void;
  /** Bulk-load a full BannerState — used when editing a scheduled banner. */
  loadState: (state: BannerState) => void;
  setCtaText: (text: string) => void;
  setBadgeText: (text: string) => void;
  setShowTnc: (show: boolean) => void;
  toggleTnc: () => void;
  setShowBadge: (show: boolean) => void;
  toggleBadge: () => void;
  setTncText: (text: string) => void;
  setBrandLogoOverride: (url: string | null) => void;
  setProductNameOverride: (name: string | null) => void;
  setPriceOverride: (price: ProductPrice | null) => void;
  togglePrice: () => void;
  setSubheadingText: (text: string) => void;
  toggleLogo: () => void;
  toggleHeading: () => void;
  toggleCta: () => void;
  toggleSubheading: () => void;
  /** Set the zoom scale for the brand logo (1 = 100%). */
  setLogoScale: (scale: number) => void;
  /** Set the zoom scale for the product image (1 = 100%). */
  setProductImageScale: (scale: number) => void;
  /** Append a new user-uploaded product image source; auto-activates it; returns its id. */
  addProductImageSource: (url: string, label?: string) => string;
  /** Remove a user product image source by id; switches active to the preceding source. */
  removeProductImageSource: (id: string) => void;
  /** Switch the active product image source. */
  setActiveProductImageSource: (id: string) => void;
  /** Patch bg-removal state on one product image source. */
  updateProductImageSourceBg: (
    id: string,
    update: Pick<ImageSource, 'bgRemovedUrl' | 'bgRemovalStatus' | 'showBgRemoved'>,
  ) => void;
  /** Flip showBgRemoved on a specific product image source. */
  toggleSourceBgRemoved: (id: string) => void;
  /** Append a new user-uploaded logo source; auto-activates it; returns its id. */
  addLogoImageSource: (url: string, label?: string) => string;
  /** Remove a user logo source by id; switches active to the preceding source. */
  removeLogoImageSource: (id: string) => void;
  /** Switch the active logo image source. */
  setActiveLogoImageSource: (id: string) => void;
  /** Patch bg-removal state on one logo source. */
  updateLogoImageSourceBg: (
    id: string,
    update: Pick<ImageSource, 'bgRemovedUrl' | 'bgRemovalStatus' | 'showBgRemoved'>,
  ) => void;
  /** Flip showBgRemoved on a specific logo source. */
  toggleLogoSourceBgRemoved: (id: string) => void;
}

const BannerContext = createContext<BannerContextType | undefined>(undefined);

export const BannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedProduct, setSelectedProduct] = useState<ParsedProduct | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption | null>(null);
  const [ctaText, setCtaText] = useState('SHOP NOW');
  const [badgeText, setBadgeText] = useState('Free Delivery');
  const [showTnc, setShowTnc] = useState(true);
  const [showBadge, setShowBadge] = useState(true);
  const [tncText, setTncText] = useState('*T&C Apply');
  const [brandLogoOverride, setBrandLogoOverride] = useState<string | null>(null);
  const [productNameOverride, setProductNameOverride] = useState<string | null>(null);
  const [showPrice, setShowPrice] = useState(true);
  const [priceOverride, setPriceOverride] = useState<ProductPrice | null>(null);
  const [subheadingText, setSubheadingText] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [showHeading, setShowHeading] = useState(true);
  const [showCta, setShowCta] = useState(true);
  const [showSubheading, setShowSubheading] = useState(false);
  const [productImageSources, setProductImageSources] = useState<ImageSource[]>([]);
  const [activeProductImageSourceId, setActiveProductImageSourceId] = useState<string | null>(null);
  const [logoImageSources, setLogoImageSources] = useState<ImageSource[]>([]);
  const [activeLogoImageSourceId, setActiveLogoImageSourceId] = useState<string | null>(null);
  /** Scale factor for the brand logo (1 = 100%). Range [0.5, 2.0]. */
  const [logoScale, setLogoScale] = useState(1);
  /** Scale factor for the product image (1 = 100%). Range [0.5, 2.0]. */
  const [productImageScale, setProductImageScale] = useState(1);
  const [quantityStickerText, setQuantityStickerText] = useState<string | null>(null);
  const [showQuantitySticker, setShowQuantitySticker] = useState(false);

  const toggleTnc = useCallback(() => setShowTnc(prev => !prev), []);
  const toggleBadge = useCallback(() => setShowBadge(prev => !prev), []);
  const toggleQuantitySticker = useCallback(() => setShowQuantitySticker(prev => !prev), []);
  const togglePrice = useCallback(() => setShowPrice(prev => !prev), []);
  const toggleLogo = useCallback(() => setShowLogo(prev => !prev), []);
  const toggleHeading = useCallback(() => setShowHeading(prev => !prev), []);
  const toggleCta = useCallback(() => setShowCta(prev => !prev), []);
  const toggleSubheading = useCallback(() => setShowSubheading(prev => !prev), []);

  const loadState = useCallback((state: BannerState) => {
    setSelectedProduct(state.selectedProduct);
    setSelectedBackground(state.selectedBackground);
    setCtaText(state.ctaText);
    setBadgeText(state.badgeText);
    setShowTnc(state.showTnc);
    setShowBadge(state.showBadge);
    setTncText(state.tncText);
    setBrandLogoOverride(state.brandLogoOverride);
    setProductNameOverride(state.productNameOverride);
    setShowPrice(state.showPrice);
    setPriceOverride(state.priceOverride);
    setSubheadingText(state.subheadingText);
    setShowLogo(state.showLogo);
    setShowHeading(state.showHeading);
    setShowCta(state.showCta);
    setShowSubheading(state.showSubheading);
    setProductImageSources(state.productImageSources);
    setActiveProductImageSourceId(state.activeProductImageSourceId);
    setLogoImageSources(state.logoImageSources);
    setActiveLogoImageSourceId(state.activeLogoImageSourceId);
    setLogoScale(state.logoScale);
    setProductImageScale(state.productImageScale);
    setQuantityStickerText(state.quantityStickerText);
    setShowQuantitySticker(state.showQuantitySticker);
  }, []);

  // Reset all per-product overrides when switching products.
  // Clears user image sources; initialises the catalogue source if the product has an imageUrl.
  const selectProduct = useCallback((product: ParsedProduct | null) => {
    setSelectedProduct(product);
    setProductNameOverride(null);
    setPriceOverride(null);
    setSubheadingText('');
    setBrandLogoOverride(null);
    // Reset zoom scales — each product starts at 100% zoom.
    setLogoScale(1);
    setProductImageScale(1);
    // Auto-populate quantity sticker from catalogue field
    setQuantityStickerText(product?.quantitySticker ?? null);
    setShowQuantitySticker(!!product?.quantitySticker);

    if (product?.imageUrl) {
      const catalogueSource: ImageSource = {
        id: 'catalogue',
        label: 'Catalogue',
        originalUrl: product.imageUrl,
        bgRemovedUrl: null,
        bgRemovalStatus: 'idle',
        showBgRemoved: false,
        source: 'catalogue',
      };
      setProductImageSources([catalogueSource]);
      setActiveProductImageSourceId('catalogue');
    } else {
      setProductImageSources([]);
      setActiveProductImageSourceId(null);
    }
  }, []);

  const addProductImageSource = useCallback((url: string, label?: string): string => {
    const id = crypto.randomUUID();
    setProductImageSources(prev => {
      const userCount = prev.filter(s => s.source === 'user').length;
      const newSource: ImageSource = {
        id,
        label: label ?? `Upload ${userCount + 1}`,
        originalUrl: url,
        bgRemovedUrl: null,
        bgRemovalStatus: 'idle',
        showBgRemoved: false,
        source: 'user',
      };
      return [...prev, newSource];
    });
    setActiveProductImageSourceId(id);
    return id;
  }, []);

  const removeProductImageSource = useCallback((id: string) => {
    setProductImageSources(prev => {
      const source = prev.find(s => s.id === id);
      if (!source || source.source !== 'user') return prev;

      // Revoke blob URLs to prevent memory leaks
      if (source.bgRemovedUrl?.startsWith('blob:')) URL.revokeObjectURL(source.bgRemovedUrl);
      if (source.originalUrl.startsWith('blob:')) URL.revokeObjectURL(source.originalUrl);

      const next = prev.filter(s => s.id !== id);

      // Switch active source to the preceding one (or catalogue) if needed
      setActiveProductImageSourceId(currentActive => {
        if (currentActive !== id) return currentActive;
        const removedIdx = prev.findIndex(s => s.id === id);
        const fallback = next[Math.max(0, removedIdx - 1)];
        return fallback?.id ?? null;
      });

      return next;
    });
  }, []);

  const setActiveProductImageSource = useCallback((id: string) => {
    setActiveProductImageSourceId(id);
  }, []);

  const updateProductImageSourceBg = useCallback(
    (id: string, update: Pick<ImageSource, 'bgRemovedUrl' | 'bgRemovalStatus' | 'showBgRemoved'>) => {
      setProductImageSources(prev =>
        prev.map(s => (s.id === id ? { ...s, ...update } : s)),
      );
    },
    [],
  );

  const toggleSourceBgRemoved = useCallback((id: string) => {
    setProductImageSources(prev =>
      prev.map(s => (s.id === id ? { ...s, showBgRemoved: !s.showBgRemoved } : s)),
    );
  }, []);

  // --- Logo image source methods (mirror product image source methods) ---

  const addLogoImageSource = useCallback((url: string, label?: string): string => {
    const id = crypto.randomUUID();
    setLogoImageSources(prev => {
      const userCount = prev.filter(s => s.source === 'user').length;
      const newSource: ImageSource = {
        id,
        label: label ?? `Upload ${userCount + 1}`,
        originalUrl: url,
        bgRemovedUrl: null,
        bgRemovalStatus: 'idle',
        showBgRemoved: false,
        source: 'user',
      };
      return [...prev, newSource];
    });
    setActiveLogoImageSourceId(id);
    return id;
  }, []);

  const removeLogoImageSource = useCallback((id: string) => {
    setLogoImageSources(prev => {
      const source = prev.find(s => s.id === id);
      if (!source || source.source !== 'user') return prev;
      if (source.bgRemovedUrl?.startsWith('blob:')) URL.revokeObjectURL(source.bgRemovedUrl);
      if (source.originalUrl.startsWith('blob:')) URL.revokeObjectURL(source.originalUrl);
      const next = prev.filter(s => s.id !== id);
      setActiveLogoImageSourceId(currentActive => {
        if (currentActive !== id) return currentActive;
        const removedIdx = prev.findIndex(s => s.id === id);
        const fallback = next[Math.max(0, removedIdx - 1)];
        return fallback?.id ?? null;
      });
      return next;
    });
  }, []);

  const setActiveLogoImageSource = useCallback((id: string) => {
    setActiveLogoImageSourceId(id);
  }, []);

  const updateLogoImageSourceBg = useCallback(
    (id: string, update: Pick<ImageSource, 'bgRemovedUrl' | 'bgRemovalStatus' | 'showBgRemoved'>) => {
      setLogoImageSources(prev =>
        prev.map(s => (s.id === id ? { ...s, ...update } : s)),
      );
    },
    [],
  );

  const toggleLogoSourceBgRemoved = useCallback((id: string) => {
    setLogoImageSources(prev =>
      prev.map(s => (s.id === id ? { ...s, showBgRemoved: !s.showBgRemoved } : s)),
    );
  }, []);

  const value: BannerContextType = {
    // State values
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
    logoImageSources,
    activeLogoImageSourceId,
    logoScale,
    productImageScale,
    quantityStickerText,
    showQuantitySticker,
    // Setters & toggles
    selectProduct,
    selectBackground: setSelectedBackground,
    setCtaText,
    setBadgeText,
    setShowTnc,
    toggleTnc,
    setShowBadge,
    toggleBadge,
    setTncText,
    setBrandLogoOverride,
    setProductNameOverride,
    setPriceOverride,
    togglePrice,
    setSubheadingText,
    toggleLogo,
    toggleHeading,
    toggleCta,
    toggleSubheading,
    setLogoScale,
    setProductImageScale,
    toggleQuantitySticker,
    setQuantityStickerText,
    addProductImageSource,
    removeProductImageSource,
    setActiveProductImageSource,
    updateProductImageSourceBg,
    toggleSourceBgRemoved,
    addLogoImageSource,
    removeLogoImageSource,
    setActiveLogoImageSource,
    updateLogoImageSourceBg,
    toggleLogoSourceBgRemoved,
    loadState,
  };

  return (
    <BannerContext.Provider value={value}>
      {children}
    </BannerContext.Provider>
  );
};

export const useBannerState = () => {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error('useBannerState must be used within a BannerProvider');
  }
  return context;
};
