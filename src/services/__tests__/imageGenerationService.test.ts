import { describe, it, expect } from 'vitest'
import { buildContextualAdditions, buildProductImagePrompt } from '../imageGenerationService'

describe('buildContextualAdditions', () => {
  it('returns empty string when no keywords match', () => {
    expect(buildContextualAdditions('Face Wash', 'Gentle cleanser for all skin types')).toBe('')
  })

  it('matches lemon in product name', () => {
    const result = buildContextualAdditions('Lemon Face Wash', 'Brightening formula')
    expect(result).toContain('lemon')
  })

  it('matches lemon in description', () => {
    const result = buildContextualAdditions('Vitamin C Serum', 'Enriched with lemon extract')
    expect(result).toContain('lemon')
  })

  it('matches pack of 5 before generic pack rules', () => {
    const result = buildContextualAdditions('Chips', 'Pack of 5 individual bags')
    expect(result).toContain('5')
  })

  it('matches pack of 3', () => {
    const result = buildContextualAdditions('Soap Bar', 'Pack of 3 bars')
    expect(result).toContain('3')
  })

  it('matches chocolate', () => {
    const result = buildContextualAdditions('Choco Chip Cookies', 'Rich cocoa flavour')
    expect(result).toContain('chocolate')
  })

  it('matches chips', () => {
    const result = buildContextualAdditions('Potato Chips', 'Crispy wafer snack')
    expect(result).toContain('chip')
  })

  it('matches aloe vera', () => {
    const result = buildContextualAdditions('Aloe Vera Gel', 'Pure aloe extract')
    expect(result).toContain('aloe')
  })

  it('matches turmeric / haldi', () => {
    expect(buildContextualAdditions('Haldi Face Pack', '')).toContain('turmeric')
    expect(buildContextualAdditions('Turmeric Soap', '')).toContain('turmeric')
  })

  it('matching is case-insensitive', () => {
    expect(buildContextualAdditions('LEMON FACE WASH', 'BRIGHTENING')).toContain('lemon')
  })

  it('returns first matching rule when multiple keywords present', () => {
    // "pack of 5" rule comes before individual ingredient rules
    const result = buildContextualAdditions('Lemon Chips Pack of 5', '')
    expect(result).toContain('5')
  })
})

describe('buildProductImagePrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildProductImagePrompt('Test Product', 'A test description', 'Test Brand')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('stays within MAX_PROMPT_LENGTH (2048 chars)', () => {
    const longName = 'A'.repeat(200)
    const longDesc = 'B'.repeat(1000)
    const longBrand = 'C'.repeat(1000)
    const prompt = buildProductImagePrompt(longName, longDesc, longBrand)
    expect(prompt.length).toBeLessThanOrEqual(2048)
  })

  it('includes product name', () => {
    const prompt = buildProductImagePrompt('Neem Face Wash', 'Purifying', 'Himalaya')
    expect(prompt).toContain('Neem Face Wash')
  })

  it('injects contextual addition for matching product', () => {
    const prompt = buildProductImagePrompt('Lemon Face Wash', 'With natural lemon', 'Himalaya')
    expect(prompt.toLowerCase()).toContain('lemon')
  })

  it('does not inject contextual addition when no match', () => {
    const prompt = buildProductImagePrompt('Hand Sanitiser', 'Kills 99.9% germs', 'Dettol')
    expect(prompt).not.toContain('beside it')
  })

  it('includes drop shadow instruction', () => {
    const prompt = buildProductImagePrompt('Any Product', 'Desc', 'Brand')
    expect(prompt.toLowerCase()).toContain('drop shadow')
  })

  it('instructs product to fill the frame', () => {
    const prompt = buildProductImagePrompt('Any Product', 'Desc', 'Brand')
    expect(prompt.toLowerCase()).toContain('entire frame')
  })
})

describe('buildProductImagePrompt — NSFW sanitization', () => {
  const FLAGGED_TERMS = ['breast', 'vaginal', 'vagina', 'penile', 'nipple', 'pubic', 'sexual', 'libido', 'erection']

  for (const term of FLAGGED_TERMS) {
    it(`strips "${term}" from product description`, () => {
      const prompt = buildProductImagePrompt('Health Product', `Contains ${term} care formula`, 'Brand')
      expect(prompt.toLowerCase()).not.toContain(term.toLowerCase())
    })
  }

  it('strips sensitive term from product name', () => {
    const prompt = buildProductImagePrompt('Breast Cream', 'Nourishing formula', 'Brand')
    expect(prompt.toLowerCase()).not.toContain('breast')
  })

  it('strips sensitive term from company description', () => {
    const prompt = buildProductImagePrompt('Lotion', 'Daily moisturiser', 'Libido Wellness Co.')
    expect(prompt.toLowerCase()).not.toContain('libido')
  })

  it('preserves the rest of the description after sanitizing', () => {
    const prompt = buildProductImagePrompt('Health Gel', 'Vaginal dryness relief gel', 'Brand')
    expect(prompt.toLowerCase()).toContain('dryness')
    expect(prompt.toLowerCase()).toContain('relief')
  })
})
