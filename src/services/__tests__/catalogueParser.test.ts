import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatQuantityText,
  parseApiItem,
  parseApiItems,
  extractProviders,
  groupProducts,
  getProductsWithMissingImages,
} from '../catalogueParser'
import type { ApiCatalogItem } from '@/types'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseProviderDetails = {
  id: 'provider-1',
  descriptor: {
    name: 'Test Brand',
    symbol: 'https://example.com/logo.png',
    images: ['https://example.com/store.png'],
    long_desc: 'Test Company',
    short_desc: 'Test Co',
  },
}

function makeApiItem(overrides: Partial<ApiCatalogItem> = {}): ApiCatalogItem {
  return {
    id: 'composite-1',
    item_id: 'item-1',
    item_name: 'Test Product',
    price: 100,
    mrp: 200,
    discount_percentage: 50,
    in_stock: true,
    category: 'F&B',
    city: 'Bangalore',
    state: 'Karnataka',
    bpp_id: 'test-bpp',
    provider_name: 'Test Brand',
    provider_unique_id: 'provider-1',
    total_items: 39,
    enabled_items: 35,
    item_details: {
      descriptor: {
        name: 'Test Product',
        images: ['https://example.com/product.png'],
        symbol: 'https://example.com/product.png',
        long_desc: 'A test product',
        short_desc: 'A test product',
      },
      price: {
        value: '100',
        maximum_value: '200',
        currency: 'INR',
      },
      tags: [
        { code: 'type', list: [{ code: 'type', value: 'item' }] },
        { code: 'veg_nonveg', list: [{ code: 'veg', value: 'yes' }] },
      ],
      related: false,
    },
    provider_details: baseProviderDetails,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// parseApiItem
// ---------------------------------------------------------------------------

describe('parseApiItem', () => {
  it('parses a valid API item into a ParsedProduct', () => {
    const product = parseApiItem(makeApiItem())

    expect(product).not.toBeNull()
    expect(product!.id).toBe('item-1')
    expect(product!.name).toBe('Test Product')
    expect(product!.imageUrl).toBe('https://example.com/product.png')
    expect(product!.hasValidImage).toBe(true)
    expect(product!.isVeg).toBe(true)
    expect(product!.isRelated).toBe(false)
    expect(product!.parentId).toBeNull()
  })

  it('extracts provider details correctly', () => {
    const product = parseApiItem(makeApiItem())

    expect(product!.provider.brandName).toBe('Test Brand')
    expect(product!.provider.brandLogo).toBe('https://example.com/logo.png')
    expect(product!.provider.companyName).toBe('Test Company')
  })

  it('returns null when item_id is missing', () => {
    const product = parseApiItem(makeApiItem({ item_id: '' }))
    expect(product).toBeNull()
  })

  it('detects placeholder images (noImage.png)', () => {
    const item = makeApiItem({
      item_id: 'no-img',
      item_image: undefined,
      item_details: {
        descriptor: {
          name: 'No Image Product',
          images: ['https://storage.googleapis.com/img.nb-analytics.com/noImage.png'],
          symbol: 'https://storage.googleapis.com/img.nb-analytics.com/noImage.png',
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.hasValidImage).toBe(false)
  })

  it('falls back to top-level item_image when descriptor images are missing', () => {
    const item = makeApiItem({
      item_id: 'top-img',
      item_image: 'https://storage.googleapis.com/product/TopLevel.jpeg',
      item_details: {
        descriptor: {
          name: 'Top-level Image Product',
          // no images or symbol in descriptor
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.hasValidImage).toBe(true)
    expect(product!.imageUrl).toBe('https://storage.googleapis.com/product/TopLevel.jpeg')
  })

  it('prefers descriptor.images over top-level item_image', () => {
    const item = makeApiItem({
      item_id: 'prefer-nested',
      item_image: 'https://example.com/top-level.png',
      item_details: {
        descriptor: {
          name: 'Nested Image Wins',
          images: ['https://example.com/nested.png'],
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.hasValidImage).toBe(true)
    expect(product!.imageUrl).toBe('https://example.com/nested.png')
  })

  it('uses item_image when descriptor only has noImage.png placeholder', () => {
    const item = makeApiItem({
      item_id: 'placeholder-fallback',
      item_image: 'https://storage.googleapis.com/product/Real.jpeg',
      item_details: {
        descriptor: {
          name: 'Placeholder Fallback',
          images: ['https://storage.googleapis.com/img.nb-analytics.com/noImage.png'],
          symbol: 'https://storage.googleapis.com/img.nb-analytics.com/noImage.png',
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.hasValidImage).toBe(true)
    expect(product!.imageUrl).toBe('https://storage.googleapis.com/product/Real.jpeg')
  })

  it('identifies related items with parent ID', () => {
    const item = makeApiItem({
      item_id: 'child-1',
      item_details: {
        descriptor: {
          name: 'Child Product',
          images: ['https://example.com/child.png'],
        },
        related: true,
        tags: [
          { code: 'parent', list: [{ code: 'id', value: 'parent-1' }] },
          { code: 'veg_nonveg', list: [{ code: 'non_veg', value: 'yes' }] },
        ],
      },
    })
    const product = parseApiItem(item)

    expect(product!.isRelated).toBe(true)
    expect(product!.parentId).toBe('parent-1')
    expect(product!.isVeg).toBe(false)
  })

  it('falls back to item_name when descriptor.name is missing', () => {
    const item = makeApiItem({
      item_name: 'Fallback Name',
      item_details: {
        descriptor: {
          name: '',
          images: ['https://example.com/img.png'],
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.name).toBe('Fallback Name')
  })

  it('extracts formatted prices from item_details.price', () => {
    const product = parseApiItem(makeApiItem())

    expect(product!.price).toBeDefined()
    expect(product!.price!.mrp).toBe('₹200')
    expect(product!.price!.sellingPrice).toBe('₹100')
  })

  it('sets price to undefined when all price fields are missing', () => {
    const item = makeApiItem({
      price: undefined as any,
      mrp: undefined as any,
      item_details: {
        descriptor: {
          name: 'No Price',
          images: ['https://example.com/img.png'],
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.price).toBeUndefined()
  })

  it('handles missing provider details gracefully', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_name: '',
    })
    const product = parseApiItem(item)

    expect(product!.provider.brandName).toBe('')
    expect(product!.provider.brandLogo).toBeNull()
    expect(product!.provider.companyName).toBe('')
  })

  it('falls back to raw_source.provider_details when provider_details is null', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_name: 'Top-level Name',
      raw_source: {
        provider_details: {
          id: 'raw-prov-1',
          descriptor: { name: 'Raw Source Brand', symbol: 'https://example.com/raw-logo.png' },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.provider.brandName).toBe('Raw Source Brand')
    expect(product!.provider.brandLogo).toBe('https://example.com/raw-logo.png')
  })

  it('falls back to provider_name when all provider descriptors are missing', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_name: 'Fallback Name',
    })
    const product = parseApiItem(item)

    expect(product!.provider.brandName).toBe('Fallback Name')
  })
})

// ---------------------------------------------------------------------------
// parseApiItems
// ---------------------------------------------------------------------------

describe('parseApiItems', () => {
  it('deduplicates by item_id (first wins)', () => {
    const items = [
      makeApiItem({ item_id: 'dup-1', item_name: 'First' }),
      makeApiItem({ item_id: 'dup-1', item_name: 'Second (duplicate)' }),
    ]
    const products = parseApiItems(items)

    expect(products).toHaveLength(1)
    expect(products[0]!.id).toBe('dup-1')
  })

  it('skips items that parseApiItem returns null for', () => {
    const items = [
      makeApiItem({ item_id: '' }), // invalid — no item_id
      makeApiItem({ item_id: 'valid-1' }),
    ]
    const products = parseApiItems(items)

    expect(products).toHaveLength(1)
    expect(products[0]!.id).toBe('valid-1')
  })
})

// ---------------------------------------------------------------------------
// extractProviders
// ---------------------------------------------------------------------------

describe('extractProviders', () => {
  it('extracts unique providers from API items', () => {
    const items = [
      makeApiItem({ provider_details: { ...baseProviderDetails, id: 'prov-1' } }),
      makeApiItem({
        item_id: 'item-2',
        provider_details: {
          ...baseProviderDetails,
          id: 'prov-2',
          descriptor: { name: 'Other Brand' },
        },
      }),
    ]
    const providers = extractProviders(items)

    expect(providers).toHaveLength(2)
    expect(providers[0]!.id).toBe('prov-1')
    expect(providers[1]!.id).toBe('prov-2')
  })

  it('deduplicates by provider_details.id', () => {
    const items = [
      makeApiItem({ item_id: 'a', provider_details: { ...baseProviderDetails, id: 'prov-1' } }),
      makeApiItem({ item_id: 'b', provider_details: { ...baseProviderDetails, id: 'prov-1' } }),
    ]
    const providers = extractProviders(items)

    expect(providers).toHaveLength(1)
  })

  it('extracts all provider fields correctly', () => {
    const items = [makeApiItem()]
    const providers = extractProviders(items)

    expect(providers[0]!.name).toBe('Test Brand')
    expect(providers[0]!.logo).toBe('https://example.com/logo.png')
    expect(providers[0]!.totalItems).toBe(39)
    expect(providers[0]!.enabledItems).toBe(35)
    expect(providers[0]!.city).toBe('Bangalore')
    expect(providers[0]!.state).toBe('Karnataka')
  })

  it('handles items with missing provider_details.id gracefully', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_unique_id: '' as any,
    })
    // Remove raw_source fallback too
    delete (item as any).raw_source

    const providers = extractProviders([item])
    expect(providers).toHaveLength(0)
  })

  it('falls back to raw_source.provider_details when provider_details is null', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_name: 'Top-level Name',
      raw_source: {
        provider_details: {
          id: 'raw-prov-1',
          descriptor: { name: 'Raw Brand', symbol: 'https://example.com/raw.png' },
        },
      },
    })
    const providers = extractProviders([item])

    expect(providers).toHaveLength(1)
    expect(providers[0]!.id).toBe('raw-prov-1')
    expect(providers[0]!.name).toBe('Raw Brand')
    expect(providers[0]!.logo).toBe('https://example.com/raw.png')
  })

  it('falls back to provider_unique_id when both provider_details sources lack id', () => {
    const item = makeApiItem({
      provider_details: null as any,
      provider_unique_id: 'unique-prov-99',
      provider_name: 'Fallback Provider',
    })
    const providers = extractProviders([item])

    expect(providers).toHaveLength(1)
    expect(providers[0]!.id).toBe('unique-prov-99')
    expect(providers[0]!.name).toBe('Fallback Provider')
  })
})

// ---------------------------------------------------------------------------
// groupProducts (unchanged — verify it still works)
// ---------------------------------------------------------------------------

describe('groupProducts', () => {
  it('groups standalone products with no children', () => {
    const product = parseApiItem(makeApiItem())!
    const groups = groupProducts([product])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('item-1')
    expect(groups[0]!.children).toHaveLength(0)
  })

  it('groups related items under their parent', () => {
    const parent = parseApiItem(makeApiItem({ item_id: 'parent-1' }))!
    const child = parseApiItem(
      makeApiItem({
        item_id: 'child-1',
        item_details: {
          descriptor: { name: 'Child Product', images: ['https://example.com/c.png'] },
          related: true,
          tags: [{ code: 'parent', list: [{ code: 'id', value: 'parent-1' }] }],
        },
      }),
    )!
    const groups = groupProducts([parent, child])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('parent-1')
    expect(groups[0]!.children).toHaveLength(1)
    expect(groups[0]!.children[0]!.id).toBe('child-1')
  })

  it('handles orphan related items (no standalone parent)', () => {
    const orphan1 = parseApiItem(
      makeApiItem({
        item_id: 'orphan-1',
        item_details: {
          descriptor: { name: 'Orphan 1', images: ['https://example.com/o1.png'] },
          related: true,
          tags: [{ code: 'parent', list: [{ code: 'id', value: 'missing-parent' }] }],
        },
      }),
    )!
    const orphan2 = parseApiItem(
      makeApiItem({
        item_id: 'orphan-2',
        item_details: {
          descriptor: { name: 'Orphan 2', images: ['https://example.com/o2.png'] },
          related: true,
          tags: [{ code: 'parent', list: [{ code: 'id', value: 'missing-parent' }] }],
        },
      }),
    )!
    const groups = groupProducts([orphan1, orphan2])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.parent.id).toBe('orphan-1')
    expect(groups[0]!.children).toHaveLength(1)
    expect(groups[0]!.children[0]!.id).toBe('orphan-2')
  })
})

// ---------------------------------------------------------------------------
// getProductsWithMissingImages (unchanged)
// ---------------------------------------------------------------------------

describe('getProductsWithMissingImages', () => {
  it('returns only products with missing images', () => {
    const valid = parseApiItem(makeApiItem({ item_id: 'valid' }))!
    const invalid = parseApiItem(
      makeApiItem({
        item_id: 'invalid',
        item_details: {
          descriptor: {
            name: 'No Image',
            images: ['https://storage.googleapis.com/img.nb-analytics.com/noImage.png'],
            symbol: 'https://storage.googleapis.com/img.nb-analytics.com/noImage.png',
          },
        },
      }),
    )!
    const missing = getProductsWithMissingImages([valid, invalid])

    expect(missing).toHaveLength(1)
    expect(missing[0]!.id).toBe('invalid')
  })

  it('returns empty array when all images are valid', () => {
    const product = parseApiItem(makeApiItem())!
    const missing = getProductsWithMissingImages([product])

    expect(missing).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// parseApiItem — quantity extraction (QS-10)
// ---------------------------------------------------------------------------

describe('parseApiItem — quantity extraction', () => {
  it('extracts quantity when unitized measure is present', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Pack Product',
          images: ['https://example.com/pack.png'],
        },
        quantity: {
          unitized: {
            measure: { unit: 'Pack', value: '5' },
          },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toBeDefined()
    expect(product!.quantity!.unit).toBe('Pack')
    expect(product!.quantity!.value).toBe('5')
  })

  it('returns undefined quantity when quantity field is absent', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'No Quantity Product',
          images: ['https://example.com/img.png'],
        },
        // no quantity field
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toBeUndefined()
  })

  it('returns undefined quantity when unitized is absent', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Stock Only', images: ['https://example.com/img.png'] },
        quantity: {
          available: { count: '10' },
          maximum: { count: '20' },
          // no unitized
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toBeUndefined()
  })

  it('returns undefined quantity when measure is present but unit is empty', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Bad Unit', images: ['https://example.com/img.png'] },
        quantity: {
          unitized: {
            measure: { unit: '', value: '5' },
          },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toBeUndefined()
  })

  it('returns undefined quantity when measure is present but value is empty', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Bad Value', images: ['https://example.com/img.png'] },
        quantity: {
          unitized: {
            measure: { unit: 'ml', value: '' },
          },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toBeUndefined()
  })

  it('falls back to raw_source.item_details for quantity when top-level is absent', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Raw Source Quantity', images: ['https://example.com/img.png'] },
        // no quantity at top-level item_details
      },
      raw_source: {
        item_details: {
          quantity: {
            unitized: {
              measure: { unit: 'kilogram', value: '1' },
            },
          },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toEqual({ unit: 'kilogram', value: '1' })
  })

  it('handles volume quantities correctly (e.g. 200 ml)', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Volume Product', images: ['https://example.com/img.png'] },
        quantity: {
          unitized: {
            measure: { unit: 'ml', value: '200' },
          },
        },
      },
    })
    const product = parseApiItem(item)

    expect(product!.quantity).toEqual({ unit: 'ml', value: '200' })
  })

  // --- Generic-placeholder suppression + name-regex fallback (QS-26) ----------

  it('suppresses the ONDC generic placeholder { unit:"unit", value:"1" }', () => {
    // SellerApp/Shiprocket BPPs emit this when no real quantity is configured.
    // Without a name/desc match the sticker should stay blank (undefined).
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Plain Product', images: ['https://example.com/img.png'] },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toBeUndefined()
  })

  it('suppresses the placeholder regardless of unit casing (e.g. "Unit", "UNIT")', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Plain Product', images: ['https://example.com/img.png'] },
        quantity: { unitized: { measure: { unit: 'UNIT', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toBeUndefined()
  })

  it('extracts Pack of N from product name when measure is the generic placeholder', () => {
    // Real-world case: Shiprocket item where unitized.measure = {unit:"unit", value:"1"}
    // but the product name contains "Pack of 5".
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Haldirams Bhujia 100g Pack of 5',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'Pack', value: '5' })
  })

  it('extracts Pack of N from short description when the name has no match', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Haldirams Bhujia 100g',
          short_desc: 'Pack of 3 — great value bundle',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'Pack', value: '3' })
  })

  it('name regex match is case-insensitive (PACK OF 12)', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'PACK OF 12 Biscuits', images: ['https://example.com/img.png'] },
        // no quantity field — plain absence also triggers fallback
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'Pack', value: '12' })
  })

  it('name regex matches when "pack of N" appears mid-string', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Lay\'s Classic Salted pack of 5 26g', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'Pack', value: '5' })
  })

  it('returns undefined when measure is generic and name/desc have no quantity pattern', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Plain Snack',
          short_desc: 'Delicious snack',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toBeUndefined()
  })

  it('does NOT suppress { unit:"unit", value:"5" } — non-trivial unit quantity is meaningful', () => {
    // Only value:"1" is the known generic default; "5 unit" carries real information.
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Multi-unit Product', images: ['https://example.com/img.png'] },
        quantity: { unitized: { measure: { unit: 'unit', value: '5' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'unit', value: '5' })
  })

  // --- Weight / volume extraction from product name (QS-26b) -----------------

  it('extracts weight quantity "200 GMs" from product name when measure is generic', () => {
    // Real-world case: VRD Spices "Sago (Sabudana) 200 GMs"
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Sago (Sabudana) 200 GMs',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'gms', value: '200' })
  })

  it('extracts "100 g" from product name', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Red Chili Powder 100 g', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'g', value: '100' })
  })

  it('extracts "1.5 kg" (decimal value) from product name', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Wheat Flour 1.5 kg', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'kg', value: '1.5' })
  })

  it('extracts "500ml" (no space) from product name', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Coconut Oil 500ml', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'ml', value: '500' })
  })

  it('extracts weight from shortDesc when name has no unit pattern', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Garam Masala',
          short_desc: '50 grams pure blend',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'unit', value: '1' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'grams', value: '50' })
  })

  it('unit extraction is case-insensitive', () => {
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Juice 1 L', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'l', value: '1' })
  })

  it('Pack of N takes priority over weight/volume in the same name', () => {
    // "Juice Pack of 3 200ml" — Pack of 3 should win over 200ml
    const item = makeApiItem({
      item_details: {
        descriptor: { name: 'Juice Pack of 3 200ml', images: ['https://example.com/img.png'] },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'Pack', value: '3' })
  })

  it('prefers a meaningful unitized measure over the name-regex fallback', () => {
    // measure is meaningful (200 ml) even though the name also says "Pack of 3".
    // The measure should win.
    const item = makeApiItem({
      item_details: {
        descriptor: {
          name: 'Juice Pack of 3 200ml',
          images: ['https://example.com/img.png'],
        },
        quantity: { unitized: { measure: { unit: 'ml', value: '200' } } },
      },
    })
    expect(parseApiItem(item)!.quantity).toEqual({ unit: 'ml', value: '200' })
  })
})

// ---------------------------------------------------------------------------
// formatQuantityText
// ---------------------------------------------------------------------------

describe('formatQuantityText', () => {
  it('formats Pack unit as "Pack of N"', () => {
    expect(formatQuantityText({ unit: 'Pack', value: '5' })).toBe('Pack of 5')
  })

  it('is case-insensitive for the Pack unit ("pack", "PACK")', () => {
    expect(formatQuantityText({ unit: 'pack', value: '3' })).toBe('Pack of 3')
    expect(formatQuantityText({ unit: 'PACK', value: '12' })).toBe('Pack of 12')
  })

  it('formats volume/weight units as "{value} {unit}"', () => {
    expect(formatQuantityText({ unit: 'ml', value: '200' })).toBe('200 ml')
    expect(formatQuantityText({ unit: 'g', value: '100' })).toBe('100 g')
    expect(formatQuantityText({ unit: 'kg', value: '1' })).toBe('1 kg')
  })

  it('formats generic unit quantities as "{value} {unit}"', () => {
    expect(formatQuantityText({ unit: 'unit', value: '5' })).toBe('5 unit')
  })
})

// ---------------------------------------------------------------------------
// formatPrice (unchanged)
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('formats a string value with decimals', () => {
    expect(formatPrice('499.0')).toBe('₹499')
  })

  it('formats a string value with commas', () => {
    expect(formatPrice('1299')).toBe('₹1,299')
  })

  it('formats a number input', () => {
    expect(formatPrice(1299)).toBe('₹1,299')
  })

  it('formats zero', () => {
    expect(formatPrice('0')).toBe('₹0')
  })

  it('returns empty string for non-numeric input', () => {
    expect(formatPrice('abc')).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(formatPrice('')).toBe('')
  })

  it('strips decimal places from large values', () => {
    expect(formatPrice('9999.99')).toBe('₹9,999')
  })
})

// ---------------------------------------------------------------------------
// parseApiItem — price extraction
// ---------------------------------------------------------------------------

describe('parseApiItem — price extraction', () => {
  it('extracts formatted price when both MRP and selling price exist', () => {
    const product = parseApiItem(makeApiItem())!

    expect(product.price).toBeDefined()
    expect(product.price!.mrp).toBe('₹200')
    expect(product.price!.sellingPrice).toBe('₹100')
  })

  it('sets price to undefined when all price fields are missing', () => {
    const product = parseApiItem(
      makeApiItem({
        price: undefined as any,
        mrp: undefined as any,
        item_details: {
          descriptor: { name: 'No Price', images: ['https://example.com/img.png'] },
        },
      }),
    )!

    expect(product.price).toBeUndefined()
  })

  it('sets price to undefined when maximum_value and top-level mrp are both missing', () => {
    const product = parseApiItem(
      makeApiItem({
        mrp: undefined as any,
        item_details: {
          descriptor: { name: 'Partial', images: ['https://example.com/img.png'] },
          price: { value: '100', maximum_value: undefined as any },
        },
      }),
    )!

    expect(product.price).toBeUndefined()
  })

  it('handles non-numeric price values gracefully', () => {
    const product = parseApiItem(
      makeApiItem({
        item_details: {
          descriptor: { name: 'Bad Price', images: ['https://example.com/img.png'] },
          price: { value: 'not-a-number', maximum_value: 'also-bad' },
        },
      }),
    )!

    expect(product.price).toBeUndefined()
  })

  it('falls back to top-level price/mrp when item_details.price is missing', () => {
    const product = parseApiItem(
      makeApiItem({
        price: 499,
        mrp: 699,
        item_details: {
          descriptor: { name: 'Top-level Price', images: ['https://example.com/img.png'] },
          // no nested price object
        },
      }),
    )!

    expect(product.price).toBeDefined()
    expect(product.price!.mrp).toBe('₹699')
    expect(product.price!.sellingPrice).toBe('₹499')
  })

  it('prefers nested item_details.price over top-level fields', () => {
    const product = parseApiItem(
      makeApiItem({
        price: 999,
        mrp: 1299,
        item_details: {
          descriptor: { name: 'Nested Wins', images: ['https://example.com/img.png'] },
          price: { value: '100', maximum_value: '200' },
        },
      }),
    )!

    expect(product.price).toBeDefined()
    expect(product.price!.mrp).toBe('₹200')
    expect(product.price!.sellingPrice).toBe('₹100')
  })
})
