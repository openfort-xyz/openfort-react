import { describe, expect, it } from 'vitest'
import { defaultCurrencyForCountry } from '../components/Pages/Buy/utils'

describe('defaultCurrencyForCountry', () => {
  it('prices EU and EEA buyers in euro', () => {
    for (const country of ['DE', 'FR', 'ES', 'IE', 'NO', 'IS', 'LI']) {
      expect(defaultCurrencyForCountry(country)).toBe('EUR')
    }
  })

  it('prices the US and rest of world in dollars', () => {
    for (const country of ['US', 'BR', 'JP', 'AU', 'ZA']) {
      expect(defaultCurrencyForCountry(country)).toBe('USD')
    }
  })

  it('prices the UK in dollars — it routes to the hosted checkout, and GBP settles nothing', () => {
    expect(defaultCurrencyForCountry('GB')).toBe('USD')
  })

  it('falls back to dollars when the region is unknown', () => {
    expect(defaultCurrencyForCountry(null)).toBe('USD')
    expect(defaultCurrencyForCountry(undefined)).toBe('USD')
    expect(defaultCurrencyForCountry('')).toBe('USD')
  })

  it('is case-insensitive', () => {
    expect(defaultCurrencyForCountry('de')).toBe('EUR')
    expect(defaultCurrencyForCountry('us')).toBe('USD')
  })
})
