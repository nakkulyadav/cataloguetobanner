import type { SheetRow, BackgroundOption } from '@/types'

/**
 * Public Google Sheet ID for the Digihaat promotions calendar.
 * The sheet must be shared as "Anyone with the link can view".
 */
const SHEET_ID = '1xwxI8wGPpvSMzKgQI3AE-YCGEdP1FKV5TrNm-ay-hWA'

/**
 * Public Google Sheet ID for the backgrounds configuration.
 * Columns: NAME | URL | CTA HEX | IsDefault?
 * The sheet must be shared as "Anyone with the link can view".
 */
const BACKGROUNDS_SHEET_ID = '1ADxwPbHOcT9u2r-Higpi7v_TIrvEzbkv8VRuRKAv19A'

// ---------------------------------------------------------------------------
// Column name constants — match the exact header text in the sheet
// ---------------------------------------------------------------------------
const COL_DATE = 'Date'
const COL_OFFER = 'Offer'
const COL_URL = 'URL'
const COL_DISCOUNTED_PRICE = 'Discounted Price'
const COL_HEADER = 'Header'
const COL_SUBHEADER = 'Subheader'

// ---------------------------------------------------------------------------
// Types for the raw gviz/tq JSON payload
// ---------------------------------------------------------------------------

interface GvizColumn {
  label: string
  type: string
  id?: string
}

interface GvizCell {
  v: string | number | null
  f?: string // formatted value
}

interface GvizRow {
  c: Array<GvizCell | null>
}

interface GvizTable {
  cols: GvizColumn[]
  rows: GvizRow[]
}

interface GvizResponse {
  table: GvizTable
}

// ---------------------------------------------------------------------------
// Background options — fetch & parse the backgrounds config sheet
// ---------------------------------------------------------------------------

/**
 * Converts a Google Drive share URL to a directly embeddable image URL.
 *
 * Input:  https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * Output: https://lh3.googleusercontent.com/d/{FILE_ID}
 *
 * Returns the original URL unchanged if the pattern doesn't match.
 */
function driveShareToImageUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (!match || !match[1]) return url
  return `https://lh3.googleusercontent.com/d/${match[1]}`
}

/**
 * Fetches the backgrounds Google Sheet and parses every row into a `BackgroundOption`.
 * The row marked IsDefault? = "YES" (case-insensitive) is flagged via a returned
 * `defaultId` string so callers can pick the initial selection.
 *
 * Expected columns: NAME | URL | CTA HEX | IsDefault?
 *
 * @param signal  Optional AbortSignal for request cancellation.
 * @returns       { backgrounds, defaultId } — defaultId is null when no row is marked default.
 * @throws        On network error, unexpected response shape, or JSONP parse failure.
 */
export async function fetchBackgroundOptions(
  signal?: AbortSignal,
): Promise<{ backgrounds: BackgroundOption[]; defaultId: string | null }> {
  const response = await fetch(`/api/sheets?sheetId=${BACKGROUNDS_SHEET_ID}`, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch backgrounds sheet: HTTP ${response.status}`)
  }

  let parsed: GvizResponse
  try {
    parsed = (await response.json()) as GvizResponse
  } catch {
    throw new Error('Failed to parse backgrounds sheet response as JSON')
  }

  const { cols, rows } = parsed.table

  const colIndex: Record<string, number> = {}
  cols.forEach((col, i) => { colIndex[col.label] = i })

  const required = ['NAME', 'URL', 'CTA HEX']
  for (const name of required) {
    if (colIndex[name] === undefined) {
      throw new Error(`Required column "${name}" not found in backgrounds sheet`)
    }
  }

  let defaultId: string | null = null

  const backgrounds: BackgroundOption[] = rows
    .map((row, i): BackgroundOption | null => {
      const cell = (label: string): string => {
        const idx = colIndex[label]
        if (idx === undefined) return ''
        const c = row.c[idx]
        if (!c || c.v === null || c.v === undefined) return ''
        return c.f ?? String(c.v)
      }

      const name = cell('NAME').trim()
      const rawUrl = cell('URL').trim()
      const ctaColor = cell('CTA HEX').trim() || '#2467CB'

      // Skip rows with no name or URL
      if (!name || !rawUrl) return null

      const id = `bg-sheet-${i}`
      const imageUrl = driveShareToImageUrl(rawUrl)

      const isDefault = cell('IsDefault?').trim().toLowerCase() === 'yes'
      if (isDefault && defaultId === null) defaultId = id

      return { id, name, url: imageUrl, ctaColor, ctaTextColor: '#FFFFFF' }
    })
    .filter((bg): bg is BackgroundOption => bg !== null)

  return { backgrounds, defaultId }
}

// ---------------------------------------------------------------------------
// SB-2: fetchSheetRows — fetch & parse the gviz/tq endpoint into SheetRow[]
// ---------------------------------------------------------------------------

/**
 * Fetches the promotions Google Sheet and parses every row into a `SheetRow`.
 *
 * @param signal  Optional AbortSignal for request cancellation.
 * @returns       Array of all sheet rows (unfiltered).
 * @throws        On network error, unexpected response shape, or parse failure.
 */
export async function fetchSheetRows(signal?: AbortSignal): Promise<SheetRow[]> {
  const response = await fetch(`/api/sheets?sheetId=${SHEET_ID}`, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch promotions sheet: HTTP ${response.status}`)
  }

  let parsed: GvizResponse
  try {
    parsed = (await response.json()) as GvizResponse
  } catch {
    throw new Error('Failed to parse promotions sheet response as JSON')
  }

  const { cols, rows } = parsed.table

  // Build a column-label → index map for resilient column lookup.
  // Keys are lowercased so matching is case-insensitive.
  const colIndex: Record<string, number> = {}
  cols.forEach((col, i) => {
    colIndex[col.label.toLowerCase()] = i
  })

  // Verify required columns are present
  const required = [COL_DATE, COL_OFFER, COL_URL, COL_DISCOUNTED_PRICE, COL_HEADER, COL_SUBHEADER]
  const missing = required.filter(name => colIndex[name.toLowerCase()] === undefined)
  if (missing.length > 0) {
    const available = cols.map(c => `"${c.label}"`).join(', ')
    throw new Error(`Required column(s) not found in sheet: ${missing.map(n => `"${n}"`).join(', ')}. Available columns: ${available}`)
  }

  return rows.map((row): SheetRow => {
    const cell = (label: string): string => {
      const idx = colIndex[label.toLowerCase()]
      if (idx === undefined) return ''
      const c = row.c[idx]
      if (!c || c.v === null || c.v === undefined) return ''
      // Prefer the formatted value (f) for dates/numbers, else coerce to string
      return c.f ?? String(c.v)
    }

    const rawPrice = cell(COL_DISCOUNTED_PRICE).trim()
    const price = rawPrice ? `₹${rawPrice}` : ''

    return {
      date: cell(COL_DATE),
      offer: cell(COL_OFFER).trim(),
      productUrl: cell(COL_URL).trim(),
      price,
      heading: cell(COL_HEADER).trim(),
      subheading: cell(COL_SUBHEADER).trim(),
    }
  })
}

// ---------------------------------------------------------------------------
// SB-3: filterRowsForDate — filter rows matching the target date
// ---------------------------------------------------------------------------

/**
 * Filters sheet rows to those whose date matches `targetDate`.
 * Both sides are normalised to M/D/YYYY (no leading zeros) before comparing.
 */
export function filterRowsForDate(rows: SheetRow[], targetDate: string): SheetRow[] {
  const normalised = normaliseDateString(targetDate)
  return rows.filter(row => normaliseDateString(row.date) === normalised)
}

/**
 * Strips leading zeros from M/D/YYYY or MM/DD/YYYY date strings so that
 * "03/05/2026" and "3/5/2026" compare as equal.
 */
function normaliseDateString(date: string): string {
  // Match MM/DD/YYYY or M/D/YYYY
  const match = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return date.trim()
  const [, m = '', d = '', y = ''] = match
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
}

