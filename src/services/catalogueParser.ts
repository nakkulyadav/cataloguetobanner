import type { ParsedProduct, ProductPrice, ProductGroup, RawCatalogueEntry } from '@/types'

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

export function parseCatalogue(entries: RawCatalogueEntry[]): ParsedProduct[] {
  const productsMap = new Map<string, ParsedProduct>()

  for (const entry of entries) {
    try {
      if (typeof entry.item_details !== 'string') continue
      const itemInfo = JSON.parse(entry.item_details)
      const providerInfo = JSON.parse(entry.provider_details)

      const itemId = itemInfo.id
      if (!itemId) continue
      if (productsMap.has(itemId)) continue

      const providerLogo = providerInfo.descriptor?.symbol || null
      const brandName = providerInfo.descriptor?.name || ''
      const companyName = providerInfo.descriptor?.long_desc || providerInfo.descriptor?.short_desc || ''

      // Prefer top-level item_images (newer format) over descriptor.images
      let topLevelImages: string[] = []
      if (typeof entry.item_images === 'string') {
        try {
          const parsed = JSON.parse(entry.item_images)
          if (Array.isArray(parsed)) topLevelImages = parsed
        } catch {
          // invalid item_images JSON — fall through to descriptor
        }
      }

      const itemImages = topLevelImages.length > 0
        ? topLevelImages
        : (itemInfo.descriptor?.images || [])
      const itemFallback = itemInfo.descriptor?.symbol
      const allImages = [...itemImages, itemFallback].filter(Boolean) as string[]

      let hasValidImage = false
      let imageUrl: string | undefined = undefined

      const validImages = allImages.filter(img => !img.includes('noImage.png'))
      if (validImages.length > 0) {
        hasValidImage = true
        imageUrl = validImages[0]
      } else if (allImages.length > 0) {
        imageUrl = allImages[0]
      }

      let isVeg = false
      let isRelated = itemInfo.related === true
      let parentId: string | null = null

      if (Array.isArray(itemInfo.tags)) {
        const vegTag = itemInfo.tags.find((t: any) => t.code === 'veg_nonveg')
        if (vegTag && Array.isArray(vegTag.list)) {
          if (vegTag.list.find((l: any) => l.code === 'veg')?.value === 'yes') {
            isVeg = true
          }
        }

        const parentTag = itemInfo.tags.find((t: any) => t.code === 'parent')
        if (parentTag && Array.isArray(parentTag.list)) {
          const idVal = parentTag.list.find((l: any) => l.code === 'id')?.value
          if (idVal) parentId = idVal
        }
      }

      // Extract and format price data (MRP + selling price)
      let price: ProductPrice | undefined
      const rawMrp = itemInfo.price?.maximum_value
      const rawSelling = itemInfo.price?.value
      if (rawMrp != null && rawSelling != null) {
        const formattedMrp = formatPrice(rawMrp)
        const formattedSelling = formatPrice(rawSelling)
        if (formattedMrp && formattedSelling) {
          price = { mrp: formattedMrp, sellingPrice: formattedSelling }
        }
      }

      productsMap.set(itemId, {
        id: itemId,
        name: itemInfo.descriptor?.name || '',
        shortDesc: itemInfo.descriptor?.short_desc || itemInfo.descriptor?.long_desc || '',
        imageUrl,
        hasValidImage,
        isVeg,
        isRelated,
        parentId,
        price,
        provider: {
          brandName,
          brandLogo: providerLogo,
          companyName
        }
      })
    } catch (e) {
      // ignore invalid json
    }
  }

  return Array.from(productsMap.values())
}

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
