import { SDKConfiguration } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../errors/validation.js'
import { koraRpcUrl, solToLamports } from './transfer.js'

vi.mock('@openfort/openfort-js', () => ({
  SDKConfiguration: { getInstance: vi.fn(() => undefined) },
}))

describe('solToLamports', () => {
  it.each([
    [1, 1_000_000_000n],
    [0.000_001, 1_000n],
    [1e-7, 100n],
    [1e3, 1_000_000_000_000n],
  ])('converts %s SOL without depending on decimal notation', (amount, expected) => {
    expect(solToLamports(amount)).toBe(expected)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e-10])('rejects invalid amount %s', (amount) => {
    expect(() => solToLamports(amount)).toThrow(ValidationError)
  })

  it('rejects values outside Solana u64 token bounds', () => {
    expect(() => solToLamports(20_000_000_000)).toThrow('maximum Solana token amount')
  })
})

describe('koraRpcUrl', () => {
  it('defaults to the production Openfort API', () => {
    expect(koraRpcUrl('testnet')).toBe('https://api.openfort.io/rpc/solana/testnet')
  })

  it('uses the explicit backend URL and removes a trailing slash', () => {
    expect(koraRpcUrl('devnet', 'https://staging.example/')).toBe('https://staging.example/rpc/solana/devnet')
  })

  it('uses the configured SDK backend URL', () => {
    vi.mocked(SDKConfiguration.getInstance).mockReturnValueOnce({
      backendUrl: 'https://configured.example',
    } as ReturnType<typeof SDKConfiguration.getInstance>)
    expect(koraRpcUrl('mainnet-beta')).toBe('https://configured.example/rpc/solana/mainnet')
  })
})
