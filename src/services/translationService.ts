const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'or', label: 'Odia' },
  { code: 'ur', label: 'Urdu' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

/** Fields that can be translated. Omit a key (or set undefined) to skip it. */
export interface TranslatableFields {
  productName?: string
  subheading?: string
  cta?: string
  badge?: string
  tnc?: string
  quantitySticker?: string
}

interface MyMemoryResponse {
  responseData: { translatedText: string }
  responseStatus: number
  responseDetails?: string
}

/** Translate a single text string. Throws on network or API error. */
export async function translateText(text: string, targetLang: LanguageCode): Promise<string> {
  const url = `${MYMEMORY_API_URL}?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`)
  }

  const data: MyMemoryResponse = await response.json()

  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails ?? `Translation failed (status ${data.responseStatus})`)
  }

  return data.responseData.translatedText
}

/**
 * Translate all provided fields in parallel.
 * Returns successfully translated results and a list of per-field error messages.
 * Never throws — partial success is valid.
 */
export async function translateFields(
  fields: TranslatableFields,
  targetLang: LanguageCode,
): Promise<{ results: TranslatableFields; errors: string[] }> {
  const entries = (Object.entries(fields) as [keyof TranslatableFields, string | undefined][]).filter(
    (entry): entry is [keyof TranslatableFields, string] =>
      entry[1] !== undefined && entry[1].trim() !== '',
  )

  const settled = await Promise.allSettled(
    entries.map(([, value]) => translateText(value, targetLang)),
  )

  const results: TranslatableFields = {}
  const errors: string[] = []

  settled.forEach((result, i) => {
    const key = entries[i]![0]
    if (result.status === 'fulfilled') {
      results[key] = result.value
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      errors.push(`${key}: ${reason}`)
    }
  })

  return { results, errors }
}
