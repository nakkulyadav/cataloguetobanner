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

/**
 * Google Visualization query endpoint.
 * Returns JSONP-wrapped JSON for publicly shared sheets — no API key required,
 * and Google sets proper CORS headers for public access.
 */
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`

// ---------------------------------------------------------------------------
// Column name constants — match the exact header text in the sheet
// ---------------------------------------------------------------------------
const COL_DATE = 'Date'
const COL_TEAM = 'Team'
const COL_PAGE = 'Page'
const COL_URL = 'URL'
const COL_DISCOUNTED_PRICE = 'DIscounted Price'
const COL_HEADER = 'Header'
const COL_SUBHEADER = 'Subheader'
/** Optional — column may not exist in all sheet versions. */
const COL_QUANTITY_STICKER = 'Quantity Sticker'

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
  const url = `https://docs.google.com/spreadsheets/d/${BACKGROUNDS_SHEET_ID}/gviz/tq?tqx=out:json`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch backgrounds sheet: HTTP ${response.status}`)
  }

  const rawText = await response.text()
  const jsonText = stripJsonpWrapper(rawText)

  let parsed: GvizResponse
  try {
    parsed = JSON.parse(jsonText) as GvizResponse
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
 * Strips the JSONP wrapper that Google wraps around gviz/tq responses.
 *
 * Google returns:  `/*O_o*‌/\ngoogle.visualization.Query.setResponse({...});`
 * We need only the JSON object inside the outermost parentheses.
 */
function stripJsonpWrapper(raw: string): string {
  const start = raw.indexOf('(')
  const end = raw.lastIndexOf(')')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unexpected gviz/tq response format — could not find JSONP wrapper')
  }
  return raw.slice(start + 1, end)
}

/**
 * Fetches the promotions Google Sheet and parses every row into a `SheetRow`.
 *
 * @param signal  Optional AbortSignal for request cancellation.
 * @returns       Array of all sheet rows (unfiltered).
 * @throws        On network error, unexpected response shape, or JSONP parse failure.
 */
export async function fetchSheetRows(signal?: AbortSignal): Promise<SheetRow[]> {
  const response = await fetch(GVIZ_URL, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch promotions sheet: HTTP ${response.status}`)
  }

  const rawText = await response.text()
  const jsonText = stripJsonpWrapper(rawText)

  let parsed: GvizResponse
  try {
    parsed = JSON.parse(jsonText) as GvizResponse
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
  const required = [COL_DATE, COL_TEAM, COL_PAGE, COL_URL, COL_DISCOUNTED_PRICE, COL_HEADER, COL_SUBHEADER]
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
      team: cell(COL_TEAM),
      page: cell(COL_PAGE),
      productUrl: cell(COL_URL).trim(),
      price,
      heading: cell(COL_HEADER).trim(),
      subheading: cell(COL_SUBHEADER).trim(),
      quantitySticker: colIndex[COL_QUANTITY_STICKER.toLowerCase()] !== undefined
        ? cell(COL_QUANTITY_STICKER).trim()
        : '',
    }
  })
}

// ---------------------------------------------------------------------------
// SB-3: filterRowsForDate — filter by date, team=bazaar, page=Banner
// ---------------------------------------------------------------------------

/**
 * Filters sheet rows to those matching the given date for the Bazaar team's banners.
 *
 * Criteria:
 *  - `date` column equals `targetDate` (exact string match, e.g. "3/30/2026")
 *  - `team` column equals "bazar page" (case-insensitive)
 *  - `page` column equals "Banner" (case-insensitive)
 *
 * Note: The gviz/tq API formats dates as M/D/YYYY (no leading zeros), so
 * we normalise the caller's date string the same way before comparing.
 */
export function filterRowsForDate(rows: SheetRow[], targetDate: string): SheetRow[] {
  // Normalise the target date: strip leading zeros from month and day.
  // The sheet stores "3/30/2026" not "03/30/2026".
  const normalised = normaliseDateString(targetDate)

  const allowedPages = ['banner', 'supermall']

  return rows.filter(
    row =>
      normaliseDateString(row.date) === normalised &&
      row.team.trim().toLowerCase() === 'bazar page' &&
      allowedPages.includes(row.page.trim().toLowerCase()),
  )
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

