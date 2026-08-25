import { describe, expect, it } from 'vitest'
import { FundingError } from '../errors/funding.js'
import { getTrustedFundingProviderUrl } from './fundingProviderUrl.js'

describe('getTrustedFundingProviderUrl', () => {
  it.each([
    [
      'coinbase',
      'https://pay.coinbase.com/buy/select-asset?sessionToken=fake-session',
      'https://pay.coinbase.com/buy/select-asset?sessionToken=fake-session',
    ],
    [
      'stripe',
      'https://crypto.link.com?client_secret=fake-client-secret',
      'https://crypto.link.com/?client_secret=fake-client-secret',
    ],
  ] as const)('accepts the %s HTTPS origin', (provider, value, expected) => {
    expect(getTrustedFundingProviderUrl(value, provider).href).toBe(expected)
  })

  it.each([
    ['coinbase', 'javascript:alert(document.domain)'],
    ['coinbase', 'https://pay.coinbase.com.attacker.example/buy'],
    ['coinbase', 'https://attacker.example/?next=https://pay.coinbase.com'],
    ['coinbase', 'https://user:password@pay.coinbase.com/buy'],
    ['coinbase', 'https://pay.coinbase.com:8443/buy'],
    ['stripe', 'http://crypto.link.com/session'],
    ['stripe', 'https://crypto.link.com.attacker.example/session'],
  ] as const)('rejects an untrusted %s destination', (provider, value) => {
    expect(() => getTrustedFundingProviderUrl(value, provider)).toThrow(FundingError)
  })
})
