import { describe, expect, it } from 'vitest'
import { CEX_CHAIN_NAMES, isCexDeliverable } from './cexChains.js'

const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'

describe('cexChains', () => {
  it('treats a Solana mainnet target as cex-deliverable (the gate that blocked Coinbase→Solana)', () => {
    expect(isCexDeliverable(SOLANA_MAINNET)).toBe(true)
    expect(CEX_CHAIN_NAMES[SOLANA_MAINNET]).toBe('Solana')
  })

  it('keeps every EVM chain Coinbase delivers to', () => {
    for (const chain of ['eip155:1', 'eip155:10', 'eip155:137', 'eip155:8453', 'eip155:42161', 'eip155:43114']) {
      expect(isCexDeliverable(chain)).toBe(true)
    }
  })

  it('rejects chains the cex rail cannot deliver to', () => {
    expect(isCexDeliverable('eip155:59144')).toBe(false) // Linea — EVM but not a Coinbase send network
    expect(isCexDeliverable('bip122:000000000019d6689c085ae165831e93')).toBe(false) // Bitcoin
    expect(isCexDeliverable('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')).toBe(false) // Solana devnet — only mainnet delivers
  })
})
