import type { ParsedProduct, ProductPrice, ProductGroup, ApiCatalogItem, ApiProvider } from '@/types'

/**
 * Formats a raw price value into a display string with ₹ prefix and comma separators.
 * Strips decimals (e.g. "499.0" → "₹499") and adds Indian-style commas (e.g. 1299 → "₹1,299").
 */
export function formatPrice(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return ''
  // Math.trunc strips decimals; toLocaleString adds commas
  return `₹${Math.trunc(num).toLocaleString('en-IN')}`
}

// ---------------------------------------------------------------------------
// API response parsers (structured item_details / provider_details objects)
// ---------------------------------------------------------------------------

/**
 * Converts a single API catalogue item into a ParsedProduct.
 * Returns null if the item is malformed (missing item_id).
 */
export function parseApiItem(item: ApiCatalogItem): ParsedProduct | null {
  const itemId = item.item_id
  if (!itemId) return null

  const descriptor = item.item_details?.descriptor
  // --- Product name ---
  const name = descriptor?.name || item.item_name || ''

  // --- Short description ---
  const shortDesc = descriptor?.short_desc || descriptor?.long_desc || ''

  // --- Images: prefer descriptor.images[], fallback to descriptor.symbol, then top-level item_image ---
  const images = (descriptor?.images || []).filter(Boolean) as string[]
  const fallbackSymbol = descriptor?.symbol
  const allImages = [...images, fallbackSymbol, item.item_image].filter(Boolean) as string[]

  let hasValidImage = false
  let imageUrl: string | undefined = undefined

  const validImages = allImages.filter(img => !img.includes('noImage.png'))
  if (validImages.length > 0) {
    hasValidImage = true
    imageUrl = validImages[0]
  } else if (allImages.length > 0) {
    imageUrl = allImages[0]
  }

  // --- Veg/non-veg & parent ID from tags ---
  let isVeg = false
  let isRelated = item.item_details?.related === true
  let parentId: string | null = null

  const tags = item.item_details?.tags
  if (Array.isArray(tags)) {
    const vegTag = tags.find(t => t.code === 'veg_nonveg')
    if (vegTag && Array.isArray(vegTag.list)) {
      if (vegTag.list.find(l => l.code === 'veg')?.value === 'yes') {
        isVeg = true
      }
    }

    const parentTag = tags.find(t => t.code === 'parent')
    if (parentTag && Array.isArray(parentTag.list)) {
      const idVal = parentTag.list.find(l => l.code === 'id')?.value
      if (idVal) parentId = idVal
    }
  }

  // --- Price formatting ---
  // Prefer nested item_details.price, fall back to top-level price/mrp fields
  let price: ProductPrice | undefined
  const rawMrp = item.item_details?.price?.maximum_value ?? item.mrp
  const rawSelling = item.item_details?.price?.value ?? item.price
  if (rawMrp != null && rawSelling != null) {
    const formattedMrp = formatPrice(rawMrp)
    const formattedSelling = formatPrice(rawSelling)
    if (formattedMrp && formattedSelling) {
      price = { mrp: formattedMrp, sellingPrice: formattedSelling }
    }
  }

  // --- Provider details (fallback: provider_details → raw_source.provider_details → top-level fields) ---
  const providerDesc = item.provider_details?.descriptor
    ?? item.raw_source?.provider_details?.descriptor
  const brandLogo = providerDesc?.symbol || null
  const brandName = providerDesc?.name || item.provider_name || ''
  const companyName = providerDesc?.long_desc || providerDesc?.short_desc || ''

  return {
    id: itemId,
    name,
    shortDesc,
    imageUrl,
    hasValidImage,
    isVeg,
    isRelated,
    parentId,
    price,
    provider: { brandName, brandLogo, companyName },
  }
}

/**
 * Parses an array of API catalogue items into deduplicated ParsedProducts.
 * First-wins deduplication by item ID (same strategy as the old parseCatalogue).
 */
export function parseApiItems(items: ApiCatalogItem[]): ParsedProduct[] {
  const productsMap = new Map<string, ParsedProduct>()

  for (const item of items) {
    const parsed = parseApiItem(item)
    if (!parsed) continue
    if (productsMap.has(parsed.id)) continue
    productsMap.set(parsed.id, parsed)
  }

  return Array.from(productsMap.values())
}

/**
 * Extracts unique providers from an array of API catalogue items.
 * Deduplicates by provider_details.id — each provider appears once.
 */
export function extractProviders(items: ApiCatalogItem[]): ApiProvider[] {
  const providersMap = new Map<string, ApiProvider>()

  for (const item of items) {
    const providerId = item.provider_details?.id
      ?? item.raw_source?.provider_details?.id
      ?? item.provider_unique_id
    if (!providerId) continue
    if (providersMap.has(providerId)) continue

    const desc = item.provider_details?.descriptor
      ?? item.raw_source?.provider_details?.descriptor

    providersMap.set(providerId, {
      id: providerId,
      name: desc?.name || item.provider_name || '',
      logo: desc?.symbol || null,
      totalItems: item.total_items || 0,
      enabledItems: item.enabled_items || 0,
      city: item.city || '',
      state: item.state || '',
    })
  }

  return Array.from(providersMap.values())
}

// ---------------------------------------------------------------------------
// Shared helpers (used by both old and new flows)
// ---------------------------------------------------------------------------

export function groupProducts(products: ParsedProduct[]): ProductGroup[] {
  const groupsMap = new Map<string, ProductGroup>()

  // Parents are items that are NOT related
  const parents = products.filter(p => !p.isRelated)
  parents.forEach(p => {
    groupsMap.set(p.id, { parent: p, children: [] })
  })

  // Children
  const children = products.filter(p => p.isRelated)

  const missingParentsMap = new Map<string, ParsedProduct[]>()

  children.forEach(child => {
    const pId = child.parentId || 'unknown'
    if (groupsMap.has(pId)) {
      groupsMap.get(pId)!.children.push(child)
    } else {
      if (!missingParentsMap.has(pId)) missingParentsMap.set(pId, [])
      missingParentsMap.get(pId)!.push(child)
    }
  })

  for (const orphans of missingParentsMap.values()) {
    if (orphans.length > 0) {
      const newParent = orphans[0]!
      groupsMap.set(newParent.id, { parent: newParent, children: orphans.slice(1) })
    }
  }

  return Array.from(groupsMap.values())
}

export function getProductsWithMissingImages(products: ParsedProduct[]): ParsedProduct[] {
  return products.filter(p => !p.hasValidImage)
}
