import { describe, it, expect } from 'vitest'
import {
  filterRowsForDate,
  extractProductUrl,
  extractPrice,
  parseComments,
} from '../sheetsService'
import type { SheetRow } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    date: '3/30/2026',
    team: 'bazar page',
    page: 'Banner',
    offerCallout: 'Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?item_id=abc&bpp_id=x&domain=y&provider_id=z',
    comments: 'Header: Fresh Fruits\nSubheader: Starting at ₹85',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// SB-3: filterRowsForDate
// ---------------------------------------------------------------------------

describe('filterRowsForDate', () => {
  const rows: SheetRow[] = [
    makeRow({ date: '3/30/2026', team: 'bazar page',  page: 'Banner' }),
    makeRow({ date: '3/30/2026', team: 'bazar page',  page: 'Homepage' }),  // wrong page
    makeRow({ date: '3/30/2026', team: 'sales',        page: 'Banner' }),   // wrong team
    makeRow({ date: '3/31/2026', team: 'bazar page',  page: 'Banner' }),   // wrong date
    makeRow({ date: '3/30/2026', team: 'Bazar Page',  page: 'Banner' }),   // team casing
    makeRow({ date: '3/30/2026', team: 'bazar page',  page: 'banner' }),   // page casing
  ]

  it('returns rows matching date, team=bazar page, page=Banner', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    // Rows 0, 4, 5 match (casing is normalised)
    expect(result).toHaveLength(3)
  })

  it('excludes rows with wrong page', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.every(r => r.page.toLowerCase() === 'banner')).toBe(true)
  })

  it('excludes rows with wrong team', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.every(r => r.team.toLowerCase() === 'bazar page')).toBe(true)
  })

  it('excludes rows with wrong date', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.some(r => r.date === '3/31/2026')).toBe(false)
  })

  it('normalises leading zeros — "03/30/2026" matches sheet "3/30/2026"', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array when no rows match', () => {
    expect(filterRowsForDate(rows, '01/01/2025')).toHaveLength(0)
  })

  it('returns empty array when given empty rows array', () => {
    expect(filterRowsForDate([], '03/30/2026')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// SB-4: extractProductUrl
// ---------------------------------------------------------------------------

describe('extractProductUrl', () => {
  it('extracts a digihaat.in product URL from a multiline string', () => {
    const input = 'Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?item_id=abc123&bpp_id=x&domain=ONDC%3ARET10&provider_id=p'
    expect(extractProductUrl(input)).toBe(
      'https://digihaat.in/en/product?item_id=abc123&bpp_id=x&domain=ONDC%3ARET10&provider_id=p'
    )
  })

  it('returns null when no URL is present', () => {
    expect(extractProductUrl('Our price - 85 + Free delivery')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractProductUrl('')).toBeNull()
  })

  it('ignores non-digihaat URLs', () => {
    expect(extractProductUrl('https://example.com/product?id=1')).toBeNull()
  })

  it('handles URL with query params in any order', () => {
    const input = 'https://digihaat.in/en/product?provider_id=d988b3a1&bpp_id=ondcseller-prod.costbo.com&domain=ONDC%3ARET10&item_id=f8626ac0'
    expect(extractProductUrl(input)).toBe(input)
  })
})

// ---------------------------------------------------------------------------
// SB-5: extractPrice
// ---------------------------------------------------------------------------

describe('extractPrice', () => {
  it('extracts a simple integer price', () => {
    expect(extractPrice('Our price - 85 + Free delivery')).toBe('₹85')
  })

  it('extracts a price with commas (thousands separator)', () => {
    expect(extractPrice('Our price - 1,299 + Free delivery')).toBe('₹1299')
  })

  it('extracts price when it is the only content', () => {
    expect(extractPrice('370')).toBe('₹370')
  })

  it('picks the first number when multiple numbers appear', () => {
    // "85" should win over any number that appears later
    expect(extractPrice('Our price - 85 + Free delivery 100')).toBe('₹85')
  })

  it('returns null when no number is found', () => {
    expect(extractPrice('Free delivery')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractPrice('')).toBeNull()
  })

  it('handles large prices with commas correctly', () => {
    expect(extractPrice('Special price - 12,999 only')).toBe('₹12999')
  })
})

// ---------------------------------------------------------------------------
// SB-6: parseComments
// ---------------------------------------------------------------------------

describe('parseComments', () => {
  it('extracts header and subheader', () => {
    const result = parseComments('Header: Fresh Fruits\nSubheader: Starting at ₹85')
    expect(result.heading).toBe('Fresh Fruits')
    expect(result.subheading).toBe('Starting at ₹85')
  })

  it('trims whitespace from extracted values', () => {
    const result = parseComments('Header:   Mango Delight  \nSubheader:  Best Deals  ')
    expect(result.heading).toBe('Mango Delight')
    expect(result.subheading).toBe('Best Deals')
  })

  it('is case-insensitive for label matching', () => {
    const result = parseComments('HEADER: Tomatoes\nSUBHEADER: Fresh daily')
    expect(result.heading).toBe('Tomatoes')
    expect(result.subheading).toBe('Fresh daily')
  })

  it('returns empty string for missing header', () => {
    const result = parseComments('Subheader: Only subheader')
    expect(result.heading).toBe('')
    expect(result.subheading).toBe('Only subheader')
  })

  it('returns empty string for missing subheader', () => {
    const result = parseComments('Header: Only header')
    expect(result.heading).toBe('Only header')
    expect(result.subheading).toBe('')
  })

  it('returns empty strings when comments is empty', () => {
    const result = parseComments('')
    expect(result.heading).toBe('')
    expect(result.subheading).toBe('')
  })

  it('returns empty strings when no labels are found', () => {
    const result = parseComments('Some random comment without labels')
    expect(result.heading).toBe('')
    expect(result.subheading).toBe('')
  })

  it('handles headers with special characters and rupee symbols', () => {
    const result = parseComments('Header: Premium Deals — ₹99 Only!\nSubheader: Limited time')
    expect(result.heading).toBe('Premium Deals — ₹99 Only!')
  })
})
