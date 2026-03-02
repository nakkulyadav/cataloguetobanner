import { describe, it, expect } from 'vitest'
import { parseCatalogue, groupProducts, getProductsWithMissingImages } from '../catalogueParser'
import type { RawCatalogueEntry } from '@/types'

function makeEntry(
  item: Record<string, unknown>,
  provider: Record<string, unknown>,
  itemImages?: string[],
): RawCatalogueEntry {
  return {
    item_details: JSON.stringify(item),
    provider_details: JSON.stringify(provider),
    ...(itemImages ? { item_images: JSON.stringify(itemImages) } : {}),
  }
}

const baseProvider = {
  id: 'provider-1',
  local_id: 'local-1',
  descriptor: {
    name: 'Test Brand',
    symbol: 'https://example.com/logo.png',
    images: ['https://example.com/store.png'],
    long_desc: 'Test Company',
    short_desc: 'Test Company',
  },
}

const baseItem = {
  id: 'item-1',
  category_id: 'F&B',
  descriptor: {
    name: 'Test Product',
    images: ['https://example.com/product.png'],
    symbol: 'https://example.com/product.png',
    long_desc: 'A test product',
    short_desc: 'A test product',
  },
  price: { currency: 'INR', value: 100, maximum_value: '200', discount: 100, discount_percentage: 50 },
  quantity: { available: { count: '10' }, maximum: { count: '10' } },
  related: false,
  tags: [
    { code: 'type', list: [{ code: 'type', value: 'item' }] },
    { code: 'veg_nonveg', list: [{ code: 'veg', value: 'yes' }] },
  ],
}

describe('parseCatalogue', () => {
  it('parses a valid catalogue entry', () => {
    const entries = [makeEntry(baseItem, baseProvider)]
    const products = parseCatalogue(entries)

    expect(products).toHaveLength(1)
    expect(products[0]!.id).toBe('item-1')
    expect(products[0]!.name).toBe('Test Product')
    expect(products[0]!.imageUrl).toBe('https://example.com/product.png')
    expect(products[0]!.hasValidImage).toBe(true)
    expect(products[0]!.isVeg).toBe(true)
    expect(products[0]!.isRelated).toBe(false)
    expect(products[0]!.parentId).toBeNull()
  })

  it('extracts provider details correctly', () => {
    const entries = [makeEntry(baseItem, baseProvider)]
    const products = parseCatalogue(entries)

    expect(products[0]!.provider.brandName).toBe('Test Brand')
    expect(products[0]!.provider.brandLogo).toBe('https://example.com/logo.png')
    expect(products[0]!.provider.companyName).toBe('Test Company')
  })

  it('deduplicates entries by item ID', () => {
    const entries = [
      makeEntry(baseItem, baseProvider),
      makeEntry(baseItem, baseProvider), // duplicate
    ]
    const products = parseCatalogue(entries)

    expect(products).toHaveLength(1)
  })

  it('detects placeholder images (noImage.png)', () => {
    const itemWithNoImage = {
      ...baseItem,
      id: 'item-no-img',
      descriptor: {
        ...baseItem.descriptor,
        images: ['https://storage.googleapis.com/img.nb-analytics.com/noImage.png'],
        symbol: 'https://storage.googleapis.com/img.nb-analytics.com/noImage.png',
      },
    }
    const entries = [makeEntry(itemWithNoImage, baseProvider)]
    const products = parseCatalogue(entries)

    expect(products[0]!.hasValidImage).toBe(false)
  })

  it('prefers top-level item_images over descriptor.images', () => {
    const topLevelUrl = 'https://example.com/top-level.png'
    const entries = [makeEntry(baseItem, baseProvider, [topLevelUrl])]
    const products = parseCatalogue(entries)

    expect(products[0]!.imageUrl).toBe(topLevelUrl)
    expect(products[0]!.hasValidImage).toBe(true)
  })

  it('falls back to descriptor.images when item_images is absent', () => {
    const entries = [makeEntry(baseItem, baseProvider)]
    const products = parseCatalogue(entries)

    expect(products[0]!.imageUrl).toBe('https://example.com/product.png')
  })

  it('falls back to descriptor.images when item_images is invalid JSON', () => {
    const entries: RawCatalogueEntry[] = [{
      item_details: JSON.stringify(baseItem),
      provider_details: JSON.stringify(baseProvider),
      item_images: 'not-valid-json',
    }]
    const products = parseCatalogue(entries)

    expect(products[0]!.imageUrl).toBe('https://example.com/product.png')
  })

  it('identifies related items with parent ID', () => {
    const relatedItem = {
      ...baseItem,
      id: 'child-1',
      related: true,
      tags: [
        { code: 'type', list: [{ code: 'type', value: 'customization' }] },
        { code: 'parent', list: [{ code: 'id', value: 'parent-1' }] },
        { code: 'veg_nonveg', list: [{ code: 'non_veg', value: 'yes' }] },
      ],
    }
    const entries = [makeEntry(relatedItem, baseProvider)]
    const products = parseCatalogue(entries)

    expect(products[0]!.isRelated).toBe(true)
    expect(products[0]!.parentId).toBe('parent-1')
    expect(products[0]!.isVeg).toBe(false)
  })

  it('skips entries with invalid JSON', () => {
    const entries: RawCatalogueEntry[] = [
      { item_details: 'not-json', provider_details: 'not-json' },
      makeEntry(baseItem, baseProvider),
    ]
    const products = parseCatalogue(entries)

    expect(products).toHaveLength(1)
    expect(products[0]!.id).toBe('item-1')
  })
})

describe('groupProducts', () => {
  it('groups standalone products with no children', () => {
    const entries = [makeEntry(baseItem, baseProvider)]
    const products = parseCatalogue(entries)
    const groups = groupProducts(products)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('item-1')
    expect(groups[0]!.children).toHaveLength(0)
  })

  it('groups related items under their parent', () => {
    const parentItem = { ...baseItem, id: 'parent-1' }
    const childItem = {
      ...baseItem,
      id: 'child-1',
      descriptor: { ...baseItem.descriptor, name: 'Child Product' },
      related: true,
      tags: [
        { code: 'parent', list: [{ code: 'id', value: 'parent-1' }] },
        { code: 'veg_nonveg', list: [{ code: 'veg', value: 'yes' }] },
      ],
    }
    const entries = [makeEntry(parentItem, baseProvider), makeEntry(childItem, baseProvider)]
    const products = parseCatalogue(entries)
    const groups = groupProducts(products)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('parent-1')
    expect(groups[0]!.children).toHaveLength(1)
    expect(groups[0]!.children[0]!.id).toBe('child-1')
  })

  it('handles orphan related items (no standalone parent)', () => {
    const orphan1 = {
      ...baseItem,
      id: 'orphan-1',
      descriptor: { ...baseItem.descriptor, name: 'Orphan 1' },
      related: true,
      tags: [
        { code: 'parent', list: [{ code: 'id', value: 'missing-parent' }] },
        { code: 'veg_nonveg', list: [{ code: 'veg', value: 'yes' }] },
      ],
    }
    const orphan2 = {
      ...baseItem,
      id: 'orphan-2',
      descriptor: { ...baseItem.descriptor, name: 'Orphan 2' },
      related: true,
      tags: [
        { code: 'parent', list: [{ code: 'id', value: 'missing-parent' }] },
        { code: 'veg_nonveg', list: [{ code: 'veg', value: 'yes' }] },
      ],
    }
    const entries = [makeEntry(orphan1, baseProvider), makeEntry(orphan2, baseProvider)]
    const products = parseCatalogue(entries)
    const groups = groupProducts(products)

    // Orphans grouped together, first one becomes the representative parent
    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('orphan-1')
    expect(groups[0]!.children).toHaveLength(1)
    expect(groups[0]!.children[0]!.id).toBe('orphan-2')
  })
})

describe('getProductsWithMissingImages', () => {
  it('returns only products with missing images', () => {
    const validItem = { ...baseItem, id: 'valid' }
    const invalidItem = {
      ...baseItem,
      id: 'invalid',
      descriptor: {
        ...baseItem.descriptor,
        images: ['https://storage.googleapis.com/img.nb-analytics.com/noImage.png'],
        symbol: 'https://storage.googleapis.com/img.nb-analytics.com/noImage.png',
      },
    }
    const entries = [makeEntry(validItem, baseProvider), makeEntry(invalidItem, baseProvider)]
    const products = parseCatalogue(entries)
    const missing = getProductsWithMissingImages(products)

    expect(missing).toHaveLength(1)
    expect(missing[0]!.id).toBe('invalid')
  })

  it('returns empty array when all images are valid', () => {
    const entries = [makeEntry(baseItem, baseProvider)]
    const products = parseCatalogue(entries)
    const missing = getProductsWithMissingImages(products)

    expect(missing).toHaveLength(0)
  })
})
