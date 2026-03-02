import { useState, useEffect } from 'react';
import type { ParsedProduct, ProductGroup, RawCatalogueEntry } from '../types';
import { parseCatalogue, groupProducts, getProductsWithMissingImages } from '../services/catalogueParser';
import { useLogs } from './useLogs';

/**
 * Fetches the catalogue JSON, parses entries into products,
 * groups them by parent-child relationships, and detects missing images.
 */
export const useCatalogue = (catalogueUrl: string) => {
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [missingImageProducts, setMissingImageProducts] = useState<ParsedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addLog } = useLogs();

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch raw JSON catalogue
        const response = await fetch(catalogueUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const rawEntries: RawCatalogueEntry[] = await response.json();

        if (!mounted) return;

        // Parse → group → detect missing images
        const parsed = parseCatalogue(rawEntries);
        const grouped = groupProducts(parsed);
        const missing = getProductsWithMissingImages(parsed);

        setProducts(parsed);
        setGroups(grouped);
        setMissingImageProducts(missing);

        addLog('info', `Loaded ${parsed.length} products in ${grouped.length} groups.`);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        addLog('error', `Failed to load catalogue: ${message}`);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (catalogueUrl) {
      loadData();
    }

    return () => { mounted = false; };
  }, [catalogueUrl, addLog]);

  return { products, groups, isLoading, error, missingImageProducts };
};
