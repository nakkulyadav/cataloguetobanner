import React, { createContext, useContext, useState, useCallback } from 'react';
import { formatQuantityText } from '@/services/catalogueParser';
import type { BannerState, ParsedProduct, BackgroundOption, ProductPrice } from '../types';

interface BannerContextType extends BannerState {
  selectProduct: (product: ParsedProduct | null) => void;
  selectBackground: (bg: BackgroundOption | null) => void;
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
  setProductImageOverride: (url: string | null) => void;
  toggleQuantitySticker: () => void;
  setQuantityStickerText: (text: string | null) => void;
  /** Set the zoom scale for the brand logo (1 = 100%). */
  setLogoScale: (scale: number) => void;
  /** Set the zoom scale for the product image (1 = 100%). */
  setProductImageScale: (scale: number) => void;
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
  const [productImageOverride, setProductImageOverride] = useState<string | null>(null);
  const [showQuantitySticker, setShowQuantitySticker] = useState(false);
  const [quantityStickerText, setQuantityStickerText] = useState<string | null>(null);
  /** Scale factor for the brand logo (1 = 100%). Range [0.5, 2.0]. */
  const [logoScale, setLogoScale] = useState(1);
  /** Scale factor for the product image (1 = 100%). Range [0.5, 2.0]. */
  const [productImageScale, setProductImageScale] = useState(1);

  const toggleTnc = useCallback(() => setShowTnc(prev => !prev), []);
  const toggleBadge = useCallback(() => setShowBadge(prev => !prev), []);
  const togglePrice = useCallback(() => setShowPrice(prev => !prev), []);
  const toggleLogo = useCallback(() => setShowLogo(prev => !prev), []);
  const toggleHeading = useCallback(() => setShowHeading(prev => !prev), []);
  const toggleCta = useCallback(() => setShowCta(prev => !prev), []);
  const toggleSubheading = useCallback(() => setShowSubheading(prev => !prev), []);
  const toggleQuantitySticker = useCallback(() => setShowQuantitySticker(prev => !prev), []);

  // Reset all per-product overrides when switching products.
  // Prevents stale blob URLs and cross-product state bleed.
  const selectProduct = useCallback((product: ParsedProduct | null) => {
    setSelectedProduct(product);
    setProductNameOverride(null);
    setPriceOverride(null);
    setSubheadingText('');
    setBrandLogoOverride(null);
    setProductImageOverride(null);
    // Auto-populate quantity sticker from catalogue data.
    // "{value} {unit}" e.g. "5 Pack" or "200 ml".
    // Clears to null when the product has no quantity data.
    setQuantityStickerText(
      product?.quantity ? formatQuantityText(product.quantity) : null,
    );
    // Reset zoom scales — each product starts at 100% zoom.
    setLogoScale(1);
    setProductImageScale(1);
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
    productImageOverride,
    showQuantitySticker,
    quantityStickerText,
    logoScale,
    productImageScale,
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
    setProductImageOverride,
    toggleQuantitySticker,
    setQuantityStickerText,
    setLogoScale,
    setProductImageScale,
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
