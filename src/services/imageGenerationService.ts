import { BRAND_LOGO } from '@/constants/bannerTemplate'
import { removeBackground } from '@/services/removeBackgroundService'

const MAX_PROMPT_LENGTH = 2048

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

// Terms that are medically/commercially legitimate but reliably trip CF's NSFW
// classifier when they appear in a generation prompt. Replace with neutral stand-ins.
const NSFW_SANITIZE: Array<[RegExp, string]> = [
  [/\b(breast|breasts)\b/gi, 'chest'],
  [/\bvaginal?\b/gi, 'intimate'],
  [/\bpenile?\b/gi, 'intimate'],
  [/\banal\b/gi, 'topical'],
  [/\bnipple\b/gi, 'area'],
  [/\bpubic\b/gi, 'body'],
  [/\bsexual(ly)?\b/gi, 'personal'],
  [/\blibido\b/gi, 'wellness'],
  [/\berect(ion)?\b/gi, 'firm'],
]

function sanitizeForPrompt(text: string): string {
  return NSFW_SANITIZE.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text)
}

// Keyword → contextual scene addition.
// Order matters: more specific entries should appear before general ones.
const CONTEXT_RULES: Array<{ keywords: string[]; addition: string }> = [
  { keywords: ['pack of 5', '5 pack', 'pack of five'], addition: 'arranged as a group of 5 identical packets' },
  { keywords: ['pack of 4', '4 pack', 'pack of four'], addition: 'arranged as a group of 4 identical packets' },
  { keywords: ['pack of 3', '3 pack', 'pack of three'], addition: 'arranged as a group of 3 identical packets' },
  { keywords: ['pack of 2', '2 pack', 'pack of two', 'combo', 'duo'], addition: 'arranged as a pair of identical packets' },
  { keywords: ['lemon', 'nimbu', 'citrus', 'lime'], addition: 'with fresh lemon slices and whole lemons beside it' },
  { keywords: ['orange', 'narangi', 'santra'], addition: 'with fresh orange slices beside it' },
  { keywords: ['mango', 'aam', 'alphonso'], addition: 'with fresh mango slices and a whole mango beside it' },
  { keywords: ['strawberry', 'strawberries'], addition: 'with fresh strawberries beside it' },
  { keywords: ['aloe', 'aloe vera'], addition: 'with fresh aloe vera leaves beside it' },
  { keywords: ['rose', 'gulab'], addition: 'with rose petals scattered beside it' },
  { keywords: ['mint', 'pudina'], addition: 'with fresh mint leaves beside it' },
  { keywords: ['neem'], addition: 'with neem leaves arranged beside it' },
  { keywords: ['turmeric', 'haldi'], addition: 'with turmeric root and powder beside it' },
  { keywords: ['charcoal'], addition: 'with activated charcoal pieces beside it' },
  { keywords: ['coffee', 'caffeine'], addition: 'with coffee beans scattered beside it' },
  { keywords: ['honey', 'shehad'], addition: 'with a honeycomb and honey drizzle beside it' },
  { keywords: ['chocolate', 'choco', 'cocoa'], addition: 'with chocolate pieces and cocoa powder beside it' },
  { keywords: ['chips', 'crisps', 'wafer'], addition: 'with a few chips spilling out beside the packet' },
  { keywords: ['biscuit', 'cookie', 'cracker'], addition: 'with a couple of biscuits broken open beside the pack' },
  { keywords: ['milk', 'dairy', 'cream'], addition: 'with a small glass of milk beside it' },
  { keywords: ['coconut', 'nariyal', 'coconut oil'], addition: 'with a halved coconut beside it' },
]

/**
 * Extracts a short contextual scene phrase based on keywords in the product
 * name and description. Returns an empty string when nothing matches.
 */
export function buildContextualAdditions(name: string, desc: string): string {
  const haystack = `${name} ${desc}`.toLowerCase()
  for (const rule of CONTEXT_RULES) {
    if (rule.keywords.some(kw => haystack.includes(kw))) {
      return rule.addition
    }
  }
  return ''
}

export function buildProductImagePrompt(
  name: string,
  shortDesc: string,
  companyDesc: string,
): string {
  const contextAddition = buildContextualAdditions(name, shortDesc)
  const sceneClause = contextAddition ? `, ${contextAddition}` : ''

  const static_ =
    'Professional studio-quality product photograph, pure white background, no backdrop. ' +
    'Product fills the entire frame edge-to-edge at maximum size — no dead space around edges. ' +
    `Soft even studio lighting with a realistic drop shadow directly beneath the product${sceneClause}. ` +
    'Preserve every detail of the original product: label text, colours, shape, and packaging design exactly as-is. ' +
    'No text overlays, no watermarks, no borders, no extra objects unrelated to the product.'

  const budget = MAX_PROMPT_LENGTH - static_.length - 20
  const nameT = truncate(sanitizeForPrompt(name), 100)
  const descT = truncate(sanitizeForPrompt(shortDesc), Math.floor(budget * 0.6))
  const brandT = truncate(sanitizeForPrompt(companyDesc), Math.floor(budget * 0.4))
  return truncate(`${static_} Product: ${nameT}. ${descT}. Brand: ${brandT}.`, MAX_PROMPT_LENGTH)
}

export async function generateAiProductImage(
  imageUrl: string,
  name: string,
  shortDesc: string,
  companyDesc: string,
): Promise<{ originalUrl: string; bgRemovedUrl: string }> {
  const prompt = buildProductImagePrompt(name, shortDesc, companyDesc)

  const resp = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageUrl, prompt }),
  })

  if (!resp.ok) {
    let errorMsg = `Image generation failed (HTTP ${resp.status})`
    try {
      const body = (await resp.json()) as { error?: string; detail?: string }
      if (body.error) errorMsg = body.detail ? `${body.error}: ${body.detail}` : body.error
    } catch {
      // ignore parse failure — use the default message
    }
    throw new Error(errorMsg)
  }

  const { url: originalUrl } = (await resp.json()) as { url: string; cached: boolean }
  const bgRemovedUrl = await removeBackground(originalUrl)

  return { originalUrl, bgRemovedUrl }
}

/** Returns true for URLs that are already same-origin (no CORS proxy needed). */
function isLocalUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

export async function resizeLogoToFit(logoUrl: string): Promise<string> {
  const maxW = BRAND_LOGO.width
  const maxH = BRAND_LOGO.height

  const fetchUrl = isLocalUrl(logoUrl)
    ? logoUrl
    : `/api/image?url=${encodeURIComponent(logoUrl)}`

  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      const drawW = img.naturalWidth * scale
      const drawH = img.naturalHeight * scale

      const canvas = document.createElement('canvas')
      canvas.width = maxW
      canvas.height = maxH

      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, maxW, maxH)

      const offsetX = (maxW - drawW) / 2
      const offsetY = (maxH - drawH) / 2
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH)

      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => reject(new Error(`Failed to load logo image: ${logoUrl}`))
    img.src = fetchUrl
  })
}
