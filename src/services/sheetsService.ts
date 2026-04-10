import type { SheetRow } from '@/types'

/**
 * Public Google Sheet ID for the Digihaat promotions calendar.
 * The sheet must be shared as "Anyone with the link can view".
 */
const SHEET_ID = '17c4n6socMBDYbssb6L1jG-rSAVJ63uXB0XsOuG_jHdE'

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
const COL_PAGE = 'Page\nHomepage/Food/Grocery etc'
const COL_OFFER_CALLOUT = 'Offer callout'
const COL_COMMENTS = 'Comments'
/** Optional — column may not exist in older sheet versions. */
const COL_QUANTITY_STICKER = 'quantity sticker'

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
  // This is robust to column reordering in the sheet.
  const colIndex: Record<string, number> = {}
  cols.forEach((col, i) => {
    colIndex[col.label] = i
  })

  // Verify required columns are present
  const required = [COL_DATE, COL_TEAM, COL_PAGE, COL_OFFER_CALLOUT, COL_COMMENTS]
  for (const name of required) {
    if (colIndex[name] === undefined) {
      throw new Error(`Required column "${name}" not found in sheet`)
    }
  }

  return rows.map((row): SheetRow => {
    const cell = (label: string): string => {
      const idx = colIndex[label] as number
      const c = row.c[idx]
      if (!c || c.v === null || c.v === undefined) return ''
      // Prefer the formatted value (f) for dates/numbers, else coerce to string
      return c.f ?? String(c.v)
    }

    return {
      date: cell(COL_DATE),
      team: cell(COL_TEAM),
      page: cell(COL_PAGE),
      offerCallout: cell(COL_OFFER_CALLOUT),
      comments: cell(COL_COMMENTS),
      quantitySticker: colIndex[COL_QUANTITY_STICKER] !== undefined
        ? cell(COL_QUANTITY_STICKER)
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

// ---------------------------------------------------------------------------
// SB-4: extractProductUrl — pull the digihaat.in product link from Offer callout
// ---------------------------------------------------------------------------

/**
 * Extracts the first `digihaat.in/en/product` URL from the raw Offer callout text.
 *
 * The Offer callout is a multiline string like:
 *   "Our price - 85 + Free delivery\n\nhttps://digihaat.in/en/product?..."
 *
 * Returns `null` when no URL is found.
 */
export function extractProductUrl(offerCallout: string): string | null {
  const match = offerCallout.match(/https:\/\/digihaat\.in\/en\/product\?[^\s]*/i)
  return match ? match[0] : null
}

// ---------------------------------------------------------------------------
// SB-5: extractPrice — pull the price number from Offer callout
// ---------------------------------------------------------------------------

/**
 * Extracts the first numeric value (with optional commas) from the Offer callout
 * and formats it as a rupee string, e.g. "₹1299".
 *
 * Examples:
 *   "Our price - 85 + Free delivery"       → "₹85"
 *   "Our price - 1,299 + Free delivery"    → "₹1299"
 *   "370"                                  → "₹370"
 *
 * Returns `null` when no number is found.
 */
export function extractPrice(offerCallout: string): string | null {
  // Strip URLs before matching so numbers embedded in product URLs
  // (e.g. item IDs, query param values) don't shadow the price text.
  const textWithoutUrls = offerCallout.replace(/https?:\/\/\S+/gi, '')
  const match = textWithoutUrls.match(/[\d,]+/)
  if (!match) return null
  // Strip commas (thousands separators) and prefix ₹
  const digits = match[0].replace(/,/g, '')
  return `₹${digits}`
}

// ---------------------------------------------------------------------------
// SB-6: parseComments — extract Heading and Subheading from Comments column
// ---------------------------------------------------------------------------

export interface ParsedComments {
  /** Text after "Header:" label. Empty string if label not found. */
  heading: string
  /** Text after "Subheader:" label. Empty string if label not found. */
  subheading: string
}

/**
 * Parses the "Comments" column text for "Header:" and "Subheader:" labels.
 *
 * Handles:
 *  - Case-insensitive label matching ("header:", "HEADER:", "Header:")
 *  - Leading/trailing whitespace trimming
 *  - Missing labels (returns empty string for that field)
 *
 * Example input:
 *   "Header: Fresh Fruits\nSubheader: Starts at ₹85"
 *
 * Example output:
 *   { heading: "Fresh Fruits", subheading: "Starts at ₹85" }
 */
export function parseComments(comments: string): ParsedComments {
  // Process line-by-line so that "Subheading:" never accidentally satisfies a
  // "heading" search (avoids substring false-matches in multi-line regex).
  // Each label must appear at the start of a line (after optional whitespace).
  let heading = ''
  let subheading = ''

  for (const line of comments.split('\n')) {
    const headingMatch = line.match(/^\s*header\s*:\s*(.+)$/i)
    if (headingMatch) {
      heading = (headingMatch[1] ?? '').trim()
      continue
    }
    const subheadingMatch = line.match(/^\s*subheader\s*:\s*(.+)$/i)
    if (subheadingMatch) {
      subheading = (subheadingMatch[1] ?? '').trim()
    }
  }

  return { heading, subheading }
}
