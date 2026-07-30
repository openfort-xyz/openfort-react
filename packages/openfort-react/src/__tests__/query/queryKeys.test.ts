import { ChainTypeEnum } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { hashQueryKey } from '../../query/hashQueryKey.js'
import { openfortKeys } from '../../query/queryKeys.js'
import { getWalletAssetsQueryScope } from '../../query/queryOptions.js'

describe('openfortKeys', () => {
  it('namespaces every key under the openfort prefix', () => {
    expect(openfortKeys.user()).toEqual(['openfort', 'user'])
    expect(openfortKeys.embeddedAccounts()).toEqual(['openfort', 'embeddedAccounts'])
  })

  it('returns the family prefix when called without parameters', () => {
    expect(openfortKeys.balance()).toEqual(['openfort', 'balance'])
    expect(openfortKeys.walletAssets()).toEqual(['openfort', 'walletAssets'])
    expect(openfortKeys.identity()).toEqual(['openfort', 'identity'])
    expect(openfortKeys.fundingChains()).toEqual(['openfort', 'fundingChains'])
  })

  it('appends the parameters as a single trailing segment, so the prefix still matches', () => {
    const key = openfortKeys.balance({ address: '0xabc', chainType: ChainTypeEnum.EVM, chainId: 8453 })

    expect(key).toEqual(['openfort', 'balance', { address: '0xabc', chainType: ChainTypeEnum.EVM, chainId: 8453 }])
    expect(key.slice(0, 2)).toEqual([...openfortKeys.balance()])
  })

  it('separates EVM and Solana wallet assets for the same address', () => {
    const evm = openfortKeys.walletAssets({ address: 'a', chainType: ChainTypeEnum.EVM, multiChain: false })
    const svm = openfortKeys.walletAssets({ address: 'a', chainType: ChainTypeEnum.SVM, multiChain: false })

    expect(hashQueryKey(evm)).not.toBe(hashQueryKey(svm))
  })
})

describe('hashQueryKey', () => {
  it('hashes bigints instead of throwing', () => {
    expect(() => hashQueryKey(['gas-estimate', 10n ** 18n])).not.toThrow()
    expect(hashQueryKey(['amount', 1n])).not.toBe(hashQueryKey(['amount', 2n]))
  })

  it('ignores property order inside key parameters', () => {
    expect(hashQueryKey([{ a: 1, b: 2 }])).toBe(hashQueryKey([{ b: 2, a: 1 }]))
  })
})

describe('getWalletAssetsQueryScope', () => {
  const base = { address: '0xabc', chainId: 8453, multiChain: false, assets: [], hasChain: true }

  it('enables the query once the address and chain are known', () => {
    expect(getWalletAssetsQueryScope(base).enabled).toBe(true)
  })

  it('stays disabled while the address is unknown', () => {
    expect(getWalletAssetsQueryScope({ ...base, address: undefined }).enabled).toBe(false)
  })

  it('stays disabled while the chain is unknown, rather than keying on a missing chain id', () => {
    expect(getWalletAssetsQueryScope({ ...base, chainId: undefined }).enabled).toBe(false)
    expect(getWalletAssetsQueryScope({ ...base, hasChain: false }).enabled).toBe(false)
  })

  it('needs only an address in multi-chain mode, and leaves the chain id out of the key', () => {
    const scope = getWalletAssetsQueryScope({ ...base, multiChain: true, chainId: undefined })

    expect(scope.enabled).toBe(true)
    expect(scope.queryKey).toEqual([
      'openfort',
      'walletAssets',
      { address: '0xabc', chainType: ChainTypeEnum.EVM, multiChain: true, chainId: undefined, assets: [] },
    ])
  })

  it('keys single-chain assets on the chain and the requested token list', () => {
    const scope = getWalletAssetsQueryScope({ ...base, assets: ['0xtoken'] })

    expect(hashQueryKey(scope.queryKey)).not.toBe(hashQueryKey(getWalletAssetsQueryScope(base).queryKey))
  })
})
