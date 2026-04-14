import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { translateText, translateFields, SUPPORTED_LANGUAGES } from '../translationService'
import type { LanguageCode } from '../translationService'

function mockFetch(response: object, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('SUPPORTED_LANGUAGES', () => {
  it('includes Hindi, Bengali, Tamil and 8 other Indian languages', () => {
    const codes = SUPPORTED_LANGUAGES.map(l => l.code)
    expect(codes).toContain('hi')
    expect(codes).toContain('bn')
    expect(codes).toContain('ta')
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(10)
  })

  it('every entry has a non-empty code and label', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.code.length).toBeGreaterThan(0)
      expect(lang.label.length).toBeGreaterThan(0)
    }
  })
})

describe('translateText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({
      responseData: { translatedText: 'अभी खरीदें' },
      responseStatus: 200,
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns translated text on success', async () => {
    const result = await translateText('Buy Now', 'hi')
    expect(result).toBe('अभी खरीदें')
  })

  it('calls MyMemory API with correct URL', async () => {
    await translateText('Buy Now', 'hi')
    const calledUrl = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[])[0] as string
    expect(calledUrl).toContain('api.mymemoryapi.com/get')
    expect(calledUrl).toContain('langpair=en|hi')
    expect(calledUrl).toContain(encodeURIComponent('Buy Now'))
  })

  it('throws when response.ok is false', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 429))
    await expect(translateText('test', 'hi')).rejects.toThrow('429')
  })

  it('throws when responseStatus is not 200', async () => {
    vi.stubGlobal('fetch', mockFetch({
      responseData: { translatedText: '' },
      responseStatus: 403,
      responseDetails: 'Daily limit exceeded',
    }))
    await expect(translateText('test', 'hi')).rejects.toThrow('Daily limit exceeded')
  })

  it('throws when responseStatus is not 200 and no responseDetails', async () => {
    vi.stubGlobal('fetch', mockFetch({
      responseData: { translatedText: '' },
      responseStatus: 403,
    }))
    await expect(translateText('test', 'hi')).rejects.toThrow('403')
  })
})

describe('translateFields', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('translates all provided fields in parallel', async () => {
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          responseData: { translatedText: `translated_${callCount}` },
          responseStatus: 200,
        }),
      })
    }))

    const { results, errors } = await translateFields(
      { cta: 'Shop Now', badge: 'Free Delivery', tnc: 'T&C Apply' },
      'hi' as LanguageCode,
    )

    expect(errors).toHaveLength(0)
    expect(Object.keys(results)).toHaveLength(3)
    expect(results.cta).toBeDefined()
    expect(results.badge).toBeDefined()
    expect(results.tnc).toBeDefined()
  })

  it('skips fields with empty or whitespace-only values', async () => {
    vi.stubGlobal('fetch', mockFetch({
      responseData: { translatedText: 'अभी खरीदें' },
      responseStatus: 200,
    }))

    const { results } = await translateFields({ cta: 'Shop Now', badge: '', tnc: '   ' }, 'hi')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(results.badge).toBeUndefined()
    expect(results.tnc).toBeUndefined()
  })

  it('skips undefined fields', async () => {
    vi.stubGlobal('fetch', mockFetch({
      responseData: { translatedText: 'खरीदें' },
      responseStatus: 200,
    }))

    const { results } = await translateFields({ cta: 'Buy', subheading: undefined }, 'hi')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(results.subheading).toBeUndefined()
  })

  it('returns partial results and errors on mixed success/failure', async () => {
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 2) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({}),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          responseData: { translatedText: 'अनुवाद' },
          responseStatus: 200,
        }),
      })
    }))

    const { results, errors } = await translateFields(
      { cta: 'Shop Now', badge: 'Free Delivery', tnc: 'T&C Apply' },
      'hi' as LanguageCode,
    )

    expect(Object.keys(results).length).toBeGreaterThan(0)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('429')
  })

  it('returns empty results and no errors for an empty fields object', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { results, errors } = await translateFields({}, 'hi')
    expect(results).toEqual({})
    expect(errors).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})
