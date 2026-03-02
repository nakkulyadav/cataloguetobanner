import { describe, it, expect } from 'vitest'
import { generateFilename } from '../exportService'

describe('generateFilename', () => {
  it('generates filename from product name', () => {
    expect(generateFilename('Happilo Premium Omani Dates')).toBe(
      'digihaat-happilo-premium-omani-dates',
    )
  })

  it('handles special characters', () => {
    expect(generateFilename('BK Veggie Burger + Fries (R)')).toBe(
      'digihaat-bk-veggie-burger-fries-r',
    )
  })

  it('handles undefined product name', () => {
    expect(generateFilename(undefined)).toBe('digihaat-banner')
  })

  it('handles empty string', () => {
    expect(generateFilename('')).toBe('digihaat-banner')
  })

  it('trims leading/trailing hyphens', () => {
    expect(generateFilename('  Test Product  ')).toBe('digihaat-test-product')
  })
})
