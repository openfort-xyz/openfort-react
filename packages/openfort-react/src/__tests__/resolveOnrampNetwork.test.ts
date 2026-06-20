import { ChainTypeEnum } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { resolveOnrampNetwork } from '../components/Pages/Buy/onrampApi'

describe('resolveOnrampNetwork', () => {
  it('resolves Solana wallets to the solana network (ignoring any chainId)', () => {
    expect(resolveOnrampNetwork(ChainTypeEnum.SVM)).toBe('solana')
    expect(resolveOnrampNetwork(ChainTypeEnum.SVM, 8453)).toBe('solana')
  })

  it('maps EVM chain ids to onramp network names', () => {
    expect(resolveOnrampNetwork(ChainTypeEnum.EVM, 1)).toBe('ethereum')
    expect(resolveOnrampNetwork(ChainTypeEnum.EVM, 8453)).toBe('base')
    expect(resolveOnrampNetwork(ChainTypeEnum.EVM, 137)).toBe('polygon')
  })

  it('falls back to base for an unmapped EVM chain id', () => {
    expect(resolveOnrampNetwork(ChainTypeEnum.EVM, 999999)).toBe('base')
  })

  it('returns undefined for an EVM wallet whose chain id is not ready yet', () => {
    expect(resolveOnrampNetwork(ChainTypeEnum.EVM)).toBeUndefined()
  })
})
