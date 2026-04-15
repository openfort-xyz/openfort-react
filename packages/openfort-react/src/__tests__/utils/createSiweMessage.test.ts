import { describe, expect, it } from 'vitest'
import { createSIWEMessage } from '../../siwe/create-siwe-message'

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`
const VALID_NONCE = 'abc123XYZ456'

describe('createSIWEMessage', () => {
  it('builds a SIWE message with valid inputs', () => {
    const msg = createSIWEMessage(ADDRESS, VALID_NONCE, 1)
    expect(msg).toBeDefined()
    expect(msg).toContain(VALID_NONCE)
    expect(msg).toContain('Chain ID: 1')
    expect(msg).toContain('Issued At:')
    expect(msg).toContain('Expiration Time:')
  })

  it.each([0, -1, 1.5, Number.NaN])('throws on invalid chainId %s', (chainId) => {
    expect(() => createSIWEMessage(ADDRESS, VALID_NONCE, chainId)).toThrow(/chainId/i)
  })

  it.each([
    '',
    'short',
    'with spaces',
    'nonce!@#',
    'a'.repeat(200),
    123 as unknown as string,
  ])('throws on malformed nonce %s', (nonce) => {
    expect(() => createSIWEMessage(ADDRESS, nonce as string, 1)).toThrow(/nonce/i)
  })

  it('produces an expirationTime within 10 minutes of issuedAt', () => {
    const msg = createSIWEMessage(ADDRESS, VALID_NONCE, 1) as string
    const issuedMatch = msg.match(/Issued At: (.+)/)
    const expiryMatch = msg.match(/Expiration Time: (.+)/)
    expect(issuedMatch?.[1]).toBeDefined()
    expect(expiryMatch?.[1]).toBeDefined()
    const diff = new Date(expiryMatch?.[1] ?? '').getTime() - new Date(issuedMatch?.[1] ?? '').getTime()
    expect(diff).toBe(10 * 60 * 1000)
  })
})
