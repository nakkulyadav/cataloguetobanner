/**
 * API configuration for the Digihaat catalogue search endpoint.
 *
 * Both provider discovery and product fetching use the same base URL
 * with different query parameters.
 */

export const API_BASE_URL = '/api/catalog/search'

/** Default number of items per page for API requests */
export const DEFAULT_PAGE_SIZE = 50

/**
 * Buyer Platform Provider (BPP) options — alphabetically sorted.
 * Each string is a BPP ID used as a query param in the catalogue search API.
 */
export const BPP_OPTIONS: string[] = [
  'Aavishk Sustainable Solutions Private Limited',
  'Addble',
  'Bamboology Pvt Ltd',
  'Bizom',
  'COSTBO SERVICES',
  'Eatanytime',
  'Fynd',
  'GlobalLinker Mall',
  'Green Receipt',
  'Himira',
  'Indiahandmade Store',
  'KAS commerce',
  'Kiko Live',
  'Localekart',
  'M/s Parasram Jajee',
  'MAGICPIN',
  'Mooogly',
  'Mystore',
  'Nirlim Studio',
  'nLincs',
  'ninjacart',
  'ONDC Hub',
  'Polestarre',
  'Primarc Pecan',
  'Rebel Foods',
  'Sabhyasha Retail Tech Private Limited',
  'Shikhar Store',
  'Shiprocket',
  'Shiv Shankar SHG',
  'ShopEG',
  'Shopclues',
  'smartsell.samhita.org',
  'Snapdeal',
  'The Body Shop',
  'Tipplr',
  'UNIZAP',
  'UniSouk ONDC',
  'Valar Digital Commerce Private Limited',
  'Vikra',
  'WAAYU',
  'Wcommerce',
  'Webkul',
  'Xpressbaazaar',
  'Yuukke Market Place',
  'bitsila',
  'channelier',
]

/**
 * Domain options for ONDC product categories.
 * `code` is the API value, `label` is the human-readable display name.
 */
export const DOMAIN_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'ONDC:RET10', label: 'Grocery' },
  { code: 'ONDC:RET12', label: 'Fashion' },
  { code: 'ONDC:RET13', label: 'Beauty & Personal Care' },
  { code: 'ONDC:RET14', label: 'Electronics' },
  { code: 'ONDC:RET15', label: 'Appliances' },
  { code: 'ONDC:RET16', label: 'Home & Kitchen' },
  { code: 'ONDC:RET18', label: 'Health & Wellness' },
]
