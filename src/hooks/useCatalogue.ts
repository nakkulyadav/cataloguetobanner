import { useState, useEffect } from 'react';
import type { ParsedProduct, ProductGroup, RawCatalogueEntry } from '../types';
import { parseCatalogue, groupProducts, getProductsWithMissingImages } from '../services/catalogueParser';
import { useLogs } from './useLogs';

/**
 * Fetches one or more catalogue JSON files, merges entries, parses into products,
 * groups them by parent-child relationships, and detects missing images.
 */
export const useCatalogue = (catalogueUrls: string | string[]) => {
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
        // Normalize to array
        const urls = Array.isArray(catalogueUrls) ? catalogueUrls : [catalogueUrls];

        // Fetch all catalogues in parallel
        const responses = await Promise.all(
          urls.map(url => fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            return res.json();
          }))
        );

        if (!mounted) return;

        // Merge all raw entries
        const rawEntries: RawCatalogueEntry[] = responses.flat();

        // Parse → group → detect missing images
        const parsed = parseCatalogue(rawEntries);
        const grouped = groupProducts(parsed);
        const missing = getProductsWithMissingImages(parsed);

        setProducts(parsed);
        setGroups(grouped);
        setMissingImageProducts(missing);

        addLog('info', `Loaded ${parsed.length} products in ${grouped.length} groups from ${urls.length} catalogue(s).`);

        // Log aggregate count of products missing price data
        const missingPriceCount = parsed.filter(p => !p.price).length;
        if (missingPriceCount > 0) {
          addLog('info', `Price data missing for ${missingPriceCount} product${missingPriceCount > 1 ? 's' : ''}`);
        }
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

    if (catalogueUrls) {
      loadData();
    }

    return () => { mounted = false; };
  }, [catalogueUrls, addLog]);

  return { products, groups, isLoading, error, missingImageProducts };
};
