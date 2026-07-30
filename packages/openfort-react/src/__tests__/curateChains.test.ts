import { describe, expect, it } from 'vitest'
import { curateChains, type FundingChain } from '../hooks/openfort/useFundingChains.js'

const cur = (symbol: string, native = false) => ({ symbol, address: `0x${symbol}`, decimals: 6, logo: null, native })
const chains: FundingChain[] = [
  {
    id: 'eip155:8453',
    name: 'Base',
    logo: null,
    vmType: 'evm',
    currencies: [cur('ETH', true), cur('USDC'), cur('USDT'), cur('DEGEN')],
  },
  { id: 'eip155:137', name: 'Polygon', logo: null, vmType: 'evm', currencies: [cur('POL', true), cur('USDC')] },
  { id: 'solana:x', name: 'Solana', logo: null, vmType: 'svm', currencies: [cur('SOL', true), cur('USDC')] },
]

const ids = (cs: FundingChain[]) => cs.map((c) => c.id)
const syms = (cs: FundingChain[]) => cs.map((c) => c.currencies.map((c) => c.symbol))

describe('curateChains', () => {
  it('returns everything unchanged when no allowlists are set', () => {
    expect(curateChains(chains, undefined, undefined)).toEqual(chains)
  })

  it('filters and orders by the sourceChains allowlist', () => {
    expect(ids(curateChains(chains, ['eip155:137', 'eip155:8453'], undefined))).toEqual(['eip155:137', 'eip155:8453'])
  })

  it('drops chains not in the allowlist and ignores unknown ids', () => {
    expect(ids(curateChains(chains, ['eip155:8453', 'eip155:99999'], undefined))).toEqual(['eip155:8453'])
  })

  it("the 'native' sentinel matches each chain's native currency", () => {
    const out = curateChains(chains, undefined, ['native', 'USDC'])
    expect(syms(out)).toEqual([
      ['ETH', 'USDC'],
      ['POL', 'USDC'],
      ['SOL', 'USDC'],
    ])
  })

  it('filters currencies by symbol (case-insensitive) and hides emptied chains', () => {
    const out = curateChains(chains, undefined, ['degen'])
    expect(ids(out)).toEqual(['eip155:8453']) // only Base has DEGEN
    expect(syms(out)).toEqual([['DEGEN']])
  })

  it('applies both allowlists together', () => {
    const out = curateChains(chains, ['eip155:8453', 'solana:x'], ['native', 'USDT'])
    expect(ids(out)).toEqual(['eip155:8453', 'solana:x'])
    expect(syms(out)).toEqual([
      ['ETH', 'USDT'], // Base: native + USDT
      ['SOL'], // Solana: native only (no USDT)
    ])
  })
})
