import { ChainTypeEnum } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { formatAddress, truncateEthAddress, truncateSolanaAddress } from './format.js'
import { nFormatter } from './index.js'

const EVM = '0x1234567890abcdef1234567890abcdef12345678'
const SOLANA = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

describe('address truncation', () => {
  it('keeps the leading and trailing characters of an address', () => {
    expect(truncateEthAddress(EVM)).toBe('0x1234••••5678')
    expect(truncateSolanaAddress(SOLANA)).toBe('9WzDXw••••AWWM')
  })

  it('honours a caller-supplied separator', () => {
    expect(truncateEthAddress(EVM, '...')).toBe('0x1234...5678')
    expect(truncateSolanaAddress(SOLANA, '...')).toBe('9WzDXw...AWWM')
  })

  it('returns an empty string for a missing address', () => {
    expect(truncateEthAddress(undefined)).toBe('')
    expect(truncateSolanaAddress(undefined)).toBe('')
  })

  it('leaves a string too short to shorten alone', () => {
    // Eliding these would produce more characters than the input has.
    expect(truncateEthAddress('0x1234567')).toBe('0x1234567')
    expect(truncateSolanaAddress('9WzDXwBbmkg8Z')).toBe('9WzDXwBbmkg8Z')
  })

  it('formats per chain type', () => {
    expect(formatAddress(EVM, ChainTypeEnum.EVM)).toBe('0x1234...5678')
    expect(formatAddress(SOLANA, ChainTypeEnum.SVM)).toBe('9WzD...AWWM')
  })
})

describe('nFormatter', () => {
  it('renders zero and dust with fixed precision', () => {
    expect(nFormatter(0)).toBe('0.00')
    expect(nFormatter(0.0000001)).toBe('<0.000001')
  })

  it('keeps full precision below the compact threshold', () => {
    expect(nFormatter(1)).toBe('1.00')
    expect(nFormatter(1234.5)).toBe('1234.50')
    expect(nFormatter(9999.99)).toBe('9999.99')
  })

  it('switches to a lower-cased compact suffix at ten thousand', () => {
    expect(nFormatter(10_000)).toBe('10k')
    expect(nFormatter(12_345)).toBe('12.35k')
    expect(nFormatter(1_500_000)).toBe('1.5m')
    expect(nFormatter(2_000_000_000)).toBe('2b')
    expect(nFormatter(3_400_000_000_000)).toBe('3.4t')
  })
})
