import { describe, it, expect } from 'vitest'
import { searchProducts, flattenGroupToProducts } from '../searchService'
import type { ParsedProduct, ProductGroup } from '@/types'

const mockProvider = {
  brandName: 'Test Brand',
  brandLogo: 'https://example.com/logo.png' as string | null,
  companyName: 'Test Co',
}

function makeProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    id: 'prod-1',
    name: 'Test Product',
    shortDesc: 'Test',
    imageUrl: 'https://example.com/img.png',
    hasValidImage: true,
    isVeg: true,
    isRelated: false,
    parentId: null,
    quantitySticker: null,
    provider: mockProvider,
    ...overrides,
  }
}

const sampleGroups: ProductGroup[] = [
  {
    parent: makeProduct({ id: 'burger-1', name: 'BK Veggie Burger Peri Peri Meal' }),
    children: [
      makeProduct({ id: 'burger-1a', name: 'Extra Cheese Topping', isRelated: true }),
    ],
  },
  {
    parent: makeProduct({ id: 'wrap-1', name: 'Crunchy Chicken Wrap' }),
    children: [],
  },
  {
    parent: makeProduct({ id: 'taco-1', name: 'Crunchy Veg Taco Peri Peri Meal' }),
    children: [],
  },
]

describe('searchProducts', () => {
  it('returns all groups for empty query', () => {
    const results = searchProducts('', sampleGroups)
    expect(results).toHaveLength(3)
  })

  it('returns all groups for whitespace-only query', () => {
    const results = searchProducts('   ', sampleGroups)
    expect(results).toHaveLength(3)
  })

  it('finds products by single word', () => {
    const results = searchProducts('veggie', sampleGroups)
    expect(results).toHaveLength(1)
    expect(results[0]!.parent.id).toBe('burger-1')
  })

  it('finds products by multiple words (all must match)', () => {
    const results = searchProducts('veggie burger', sampleGroups)
    expect(results).toHaveLength(1)
    expect(results[0]!.parent.id).toBe('burger-1')
  })

  it('is case-insensitive', () => {
    const results = searchProducts('VEGGIE BURGER', sampleGroups)
    expect(results).toHaveLength(1)
  })

  it('finds multiple matching groups', () => {
    const results = searchProducts('crunchy', sampleGroups)
    expect(results).toHaveLength(2)
  })

  it('finds products by peri peri (partial multi-group match)', () => {
    const results = searchProducts('peri peri', sampleGroups)
    expect(results).toHaveLength(2) // burger and taco both have "Peri Peri"
  })

  it('returns empty array when nothing matches', () => {
    const results = searchProducts('pizza', sampleGroups)
    expect(results).toHaveLength(0)
  })

  it('matches children and shows them under parent', () => {
    const results = searchProducts('cheese', sampleGroups)
    expect(results).toHaveLength(1)
    expect(results[0]!.parent.id).toBe('burger-1')
    expect(results[0]!.children).toHaveLength(1)
    expect(results[0]!.children[0]!.id).toBe('burger-1a')
  })

  it('shows full group when parent matches', () => {
    const results = searchProducts('veggie', sampleGroups)
    expect(results[0]!.children).toHaveLength(1) // all children included
  })

  it('filters children when only some match', () => {
    // Add another child that won't match
    const groups: ProductGroup[] = [
      {
        parent: makeProduct({ id: 'p1', name: 'Burger Combo' }),
        children: [
          makeProduct({ id: 'c1', name: 'Cheese Topping', isRelated: true }),
          makeProduct({ id: 'c2', name: 'Onion Rings', isRelated: true }),
        ],
      },
    ]
    const results = searchProducts('cheese', groups)
    expect(results).toHaveLength(1)
    expect(results[0]!.children).toHaveLength(1)
    expect(results[0]!.children[0]!.id).toBe('c1')
  })
})

describe('flattenGroupToProducts', () => {
  it('flattens groups into a flat product list', () => {
    const flat = flattenGroupToProducts(sampleGroups)
    expect(flat).toHaveLength(4) // 3 parents + 1 child
  })

  it('returns empty array for empty groups', () => {
    const flat = flattenGroupToProducts([])
    expect(flat).toHaveLength(0)
  })
})
