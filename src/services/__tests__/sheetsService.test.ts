import { describe, it, expect, vi } from 'vitest'
import {
  filterRowsForDate,
} from '../sheetsService'
import type { SheetRow } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    date: '3/30/2026',
    offer: 'Free delivery',
    productUrl: 'https://digihaat.in/en/product?item_id=abc&bpp_id=x&domain=ONDC%3ARET10&provider_id=z',
    price: '₹85',
    heading: 'Fresh Fruits',
    subheading: 'Starting at ₹85',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// SB-3: filterRowsForDate
// ---------------------------------------------------------------------------

describe('filterRowsForDate', () => {
  const rows: SheetRow[] = [
    makeRow({ date: '3/30/2026' }),
    makeRow({ date: '3/31/2026' }),  // wrong date
    makeRow({ date: '03/30/2026' }), // leading zeros — should normalise to match
    makeRow({ date: '4/1/2026' }),   // different date
  ]

  it('returns rows matching the target date', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result).toHaveLength(2)
  })

  it('normalises leading zeros — "03/30/2026" matches sheet "3/30/2026"', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes rows with a different date', () => {
    const result = filterRowsForDate(rows, '03/30/2026')
    expect(result.every(r => {
      const [m, d, y] = r.date.split('/')
      return `${parseInt(m!, 10)}/${parseInt(d!, 10)}/${y}` === '3/30/2026'
    })).toBe(true)
  })

  it('returns empty array when no rows match', () => {
    expect(filterRowsForDate(rows, '01/01/2025')).toHaveLength(0)
  })

  it('returns empty array when given empty rows array', () => {
    expect(filterRowsForDate([], '03/30/2026')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// fetchSheetRows — column parsing
// ---------------------------------------------------------------------------

describe('fetchSheetRows — column parsing', () => {
  // /api/sheets strips JSONP server-side and returns the parsed gviz table as JSON.
  function buildGvizResponse(cols: string[], rows: Array<Array<string | null>>): unknown {
    return {
      table: {
        cols: cols.map(label => ({ label, type: 'string', id: label })),
        rows: rows.map(cells => ({ c: cells.map(v => (v === null ? null : { v })) })),
      },
    }
  }

  function mockSheetsApi(gvizJson: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(gvizJson),
    } as unknown as Response)
  }

  const REQUIRED_COLS = ['Date', 'Offer', 'URL', 'Discounted Price', 'Header', 'Subheader']

  it('parses a full row correctly', async () => {
    mockSheetsApi(buildGvizResponse(REQUIRED_COLS, [
      ['4/2/2026', 'Free delivery', 'https://digihaat.in/en/product?item_id=abc', '19', 'Value Besan Deal', 'Best Price, Same Quality'],
    ]))

    const { fetchSheetRows } = await import('../sheetsService')
    const result = await fetchSheetRows()

    expect(result[0]).toMatchObject({
      date: '4/2/2026',
      offer: 'Free delivery',
      productUrl: 'https://digihaat.in/en/product?item_id=abc',
      price: '₹19',
      heading: 'Value Besan Deal',
      subheading: 'Best Price, Same Quality',
    })
  })

  it('prefixes price with ₹', async () => {
    mockSheetsApi(buildGvizResponse(REQUIRED_COLS, [
      ['4/2/2026', 'Free delivery', 'https://digihaat.in/en/product?item_id=abc', '129', 'Ruffpad', 'Write, Erase, Repeat'],
    ]))

    const { fetchSheetRows } = await import('../sheetsService')
    const result = await fetchSheetRows()

    expect(result[0]!.price).toBe('₹129')
  })

  it('sets price to empty string when cell is blank', async () => {
    mockSheetsApi(buildGvizResponse(REQUIRED_COLS, [
      ['4/2/2026', 'Free delivery', 'https://digihaat.in/en/product?item_id=abc', null, 'Header', 'Sub'],
    ]))

    const { fetchSheetRows } = await import('../sheetsService')
    const result = await fetchSheetRows()

    expect(result[0]!.price).toBe('')
  })

  it('throws when a required column is missing', async () => {
    const cols = ['Date', 'Offer', 'URL', 'Header', 'Subheader'] // missing 'Discounted Price'
    mockSheetsApi(buildGvizResponse(cols, [['4/2/2026', 'Free delivery', 'https://digihaat.in/', 'H', 'S']]))

    const { fetchSheetRows } = await import('../sheetsService')
    await expect(fetchSheetRows()).rejects.toThrow('Required column(s) not found in sheet')
  })
})
