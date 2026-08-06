import { ChainTypeEnum } from '@openfort/openfort-js'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { hashQueryKey } from '../../query/hashQueryKey.js'
import { getOpenfortQueryInputScope, getOpenfortQueryScope, openfortKeys } from '../../query/queryKeys.js'
import { getWalletAssetsQueryScope } from '../../query/queryOptions.js'

describe('openfortKeys', () => {
  it('namespaces every key under the openfort prefix', () => {
    expect(openfortKeys.user()).toEqual(['openfort', 'user'])
    expect(openfortKeys.embeddedAccounts()).toEqual(['openfort', 'embeddedAccounts'])
  })

  it('returns the family prefix when called without parameters', () => {
    expect(openfortKeys.user()).toEqual(['openfort', 'user'])
    expect(openfortKeys.embeddedAccounts()).toEqual(['openfort', 'embeddedAccounts'])
    expect(openfortKeys.balance()).toEqual(['openfort', 'balance'])
    expect(openfortKeys.walletAssets()).toEqual(['openfort', 'walletAssets'])
    expect(openfortKeys.erc20Balance()).toEqual(['openfort', 'erc20Balance'])
    expect(openfortKeys.transactionReceipt()).toEqual(['openfort', 'transactionReceipt'])
    expect(openfortKeys.solanaFee()).toEqual(['openfort', 'solanaFee'])
    expect(openfortKeys.gasEstimate()).toEqual(['openfort', 'gasEstimate'])
    expect(openfortKeys.identity()).toEqual(['openfort', 'identity'])
    expect(openfortKeys.fundingChains()).toEqual(['openfort', 'fundingChains'])
  })

  it('appends the parameters as a single trailing segment, so the prefix still matches', () => {
    const key = openfortKeys.balance({
      address: '0xabc',
      chainType: ChainTypeEnum.EVM,
      chainId: 8453,
      rpcUrl: 'https://rpc.example',
    })

    expect(key).toEqual([
      'openfort',
      'balance',
      {
        address: '0xabc',
        chainType: ChainTypeEnum.EVM,
        chainId: 8453,
        rpcScope: getOpenfortQueryInputScope('https://rpc.example'),
      },
    ])
    expect(key.slice(0, 2)).toEqual([...openfortKeys.balance()])
  })

  it('assigns stable, distinct scopes to Openfort client identities', () => {
    const firstClient = {}
    const secondClient = {}

    expect(getOpenfortQueryScope(firstClient)).toBe(getOpenfortQueryScope(firstClient))
    expect(getOpenfortQueryScope(firstClient)).not.toBe(getOpenfortQueryScope(secondClient))
    expect(openfortKeys.user(getOpenfortQueryScope(firstClient)).slice(0, 2)).toEqual([...openfortKeys.user()])
    expect(openfortKeys.embeddedAccounts(getOpenfortQueryScope(secondClient)).slice(0, 2)).toEqual([
      ...openfortKeys.embeddedAccounts(),
    ])
  })

  it('assigns distinct namespaces to duplicated SDK module instances', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    try {
      vi.resetModules()
      const firstModule = await import('../../query/queryKeys.js')
      const firstScope = firstModule.getOpenfortQueryScope({})
      vi.resetModules()
      const secondModule = await import('../../query/queryKeys.js')
      const secondScope = secondModule.getOpenfortQueryScope({})

      expect(firstScope).not.toBe(secondScope)
    } finally {
      now.mockRestore()
    }
  })

  it('derives deterministic, distinct non-plaintext input fingerprints', () => {
    const endpoint = 'https://user:password@rpc.example?apiKey=secret'
    const fingerprint = getOpenfortQueryInputScope(endpoint)

    expect(getOpenfortQueryInputScope(endpoint)).toBe(fingerprint)
    expect(getOpenfortQueryInputScope('https://other-rpc.example')).not.toBe(fingerprint)
    expect(fingerprint).not.toContain('password')
    expect(fingerprint).not.toContain('secret')
  })

  it('separates balance reads by effective RPC endpoint and Solana commitment', () => {
    const evm = {
      address: '0xabc',
      chainType: ChainTypeEnum.EVM,
      chainId: 8453,
      rpcUrl: 'https://rpc-a.example',
    } as const
    const solana = {
      address: 'solana-address',
      chainType: ChainTypeEnum.SVM,
      cluster: 'devnet',
      rpcUrl: 'https://solana-rpc.example',
      commitment: 'confirmed',
    } as const

    expect(hashQueryKey(openfortKeys.balance(evm))).not.toBe(
      hashQueryKey(openfortKeys.balance({ ...evm, rpcUrl: 'https://rpc-b.example' }))
    )
    expect(hashQueryKey(openfortKeys.balance(solana))).not.toBe(
      hashQueryKey(openfortKeys.balance({ ...solana, commitment: 'finalized' }))
    )
  })

  it('never copies endpoint credentials into balance query keys', () => {
    const key = openfortKeys.balance({
      address: '0xabc',
      chainType: ChainTypeEnum.EVM,
      chainId: 8453,
      rpcUrl: 'https://user:rpc-password@rpc.example/tenant-secret?apiKey=query-secret',
    })
    const serializedKey = JSON.stringify(key)

    expect(serializedKey).not.toContain('rpc-password')
    expect(serializedKey).not.toContain('tenant-secret')
    expect(serializedKey).not.toContain('query-secret')
  })

  it('isolates modal balance and receipt keys by client and transport scope', () => {
    const firstClientScope = getOpenfortQueryScope({})
    const secondClientScope = getOpenfortQueryScope({})
    const firstRpcScope = getOpenfortQueryInputScope('https://rpc-a.example')!
    const secondRpcScope = getOpenfortQueryInputScope('https://rpc-b.example')!
    const balance = {
      clientScope: firstClientScope,
      address: '0xabc',
      token: '0xtoken',
      chainId: 8453,
      rpcScope: firstRpcScope,
    }
    const receipt = { clientScope: firstClientScope, hash: '0xhash', chainId: 8453, rpcScope: firstRpcScope }

    expect(hashQueryKey(openfortKeys.erc20Balance(balance))).not.toBe(
      hashQueryKey(openfortKeys.erc20Balance({ ...balance, clientScope: secondClientScope }))
    )
    expect(hashQueryKey(openfortKeys.erc20Balance(balance))).not.toBe(
      hashQueryKey(openfortKeys.erc20Balance({ ...balance, rpcScope: secondRpcScope }))
    )
    expect(hashQueryKey(openfortKeys.transactionReceipt(receipt))).not.toBe(
      hashQueryKey(openfortKeys.transactionReceipt({ ...receipt, rpcScope: secondRpcScope }))
    )
  })

  it('isolates account-derived fee keys by client and transport scope', () => {
    const firstClientScope = getOpenfortQueryScope({})
    const secondClientScope = getOpenfortQueryScope({})
    const firstRpcScope = getOpenfortQueryInputScope('https://rpc-a.example')!
    const secondRpcScope = getOpenfortQueryInputScope('https://rpc-b.example')!
    const solanaFee = {
      clientScope: firstClientScope,
      address: 'solana-address',
      recipient: 'solana-recipient',
      rpcScope: firstRpcScope,
    }
    const gasEstimate = {
      clientScope: firstClientScope,
      account: '0xabc',
      to: '0xdef',
      value: 1n,
      chainId: 8453,
      rpcScope: firstRpcScope,
    }

    expect(hashQueryKey(openfortKeys.solanaFee(solanaFee))).not.toBe(
      hashQueryKey(openfortKeys.solanaFee({ ...solanaFee, clientScope: secondClientScope }))
    )
    expect(hashQueryKey(openfortKeys.solanaFee(solanaFee))).not.toBe(
      hashQueryKey(openfortKeys.solanaFee({ ...solanaFee, rpcScope: secondRpcScope }))
    )
    expect(hashQueryKey(openfortKeys.gasEstimate(gasEstimate))).not.toBe(
      hashQueryKey(openfortKeys.gasEstimate({ ...gasEstimate, rpcScope: secondRpcScope }))
    )
  })

  it('isolates identity RPCs while sanitizing the compatible URL input', () => {
    const first = openfortKeys.identity({
      address: '0xabc',
      chainType: ChainTypeEnum.EVM,
      ensChainId: 1,
      rpcUrl: 'https://user:identity-password@rpc.example?key=identity-secret',
    })
    const second = openfortKeys.identity({
      address: '0xabc',
      chainType: ChainTypeEnum.EVM,
      ensChainId: 1,
      rpcUrl: 'https://other-rpc.example',
    })
    const serialized = JSON.stringify(first)

    expect(hashQueryKey(first)).not.toBe(hashQueryKey(second))
    expect(serialized).not.toContain('identity-password')
    expect(serialized).not.toContain('identity-secret')
  })

  it('isolates funding backends without copying credentials into the key', () => {
    const first = openfortKeys.fundingChains({
      baseUrl: 'https://user:funding-password@funding-a.example?token=funding-secret',
      livemode: true,
    })
    const second = openfortKeys.fundingChains({ baseUrl: 'https://funding-b.example', livemode: true })
    const serializedFirst = JSON.stringify(first)

    expect(hashQueryKey(first)).not.toBe(hashQueryKey(second))
    expect(serializedFirst).not.toContain('funding-password')
    expect(serializedFirst).not.toContain('funding-secret')
  })

  it('separates EVM and Solana wallet assets for the same address', () => {
    const evm = openfortKeys.walletAssets({ address: 'a', chainType: ChainTypeEnum.EVM, multiChain: false })
    const svm = openfortKeys.walletAssets({ address: 'a', chainType: ChainTypeEnum.SVM, multiChain: false })

    expect(hashQueryKey(evm)).not.toBe(hashQueryKey(svm))
  })

  it('converts a public asset-key RPC URL to an opaque scope', () => {
    const key = openfortKeys.walletAssets({
      address: 'solana-address',
      chainType: ChainTypeEnum.SVM,
      multiChain: false,
      rpcUrl: 'https://user:password@rpc.example?apiKey=secret',
    })

    expect(JSON.stringify(key)).not.toContain('password')
    expect(JSON.stringify(key)).not.toContain('secret')
    expect(key[2]).toMatchObject({ rpcScope: expect.any(String) })
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
  const client = {}
  const base = {
    client,
    address: '0xabc',
    chainId: 8453,
    multiChain: false,
    assets: [],
    hasChain: true,
    backendUrl: 'https://api.openfort.io',
    rpcUrl: 'https://rpc.example',
  }

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
      {
        address: '0xabc',
        chainType: ChainTypeEnum.EVM,
        multiChain: true,
        clientScope: getOpenfortQueryScope(client),
        chainId: undefined,
        backendScope: getOpenfortQueryInputScope('https://api.openfort.io'),
        rpcScope: undefined,
        assets: undefined,
        assetFilter: [],
        fallbackChains: [],
      },
    ])
  })

  it('keys single-chain assets on the chain and the requested token list', () => {
    const scope = getWalletAssetsQueryScope({ ...base, assets: ['0xtoken'] })

    expect(hashQueryKey(scope.queryKey)).not.toBe(hashQueryKey(getWalletAssetsQueryScope(base).queryKey))
  })

  it('preserves the full chain-to-assets mapping in multi-chain keys', () => {
    const first = getWalletAssetsQueryScope({
      ...base,
      multiChain: true,
      assetFilter: [
        { chainId: 8453, assets: ['0xaaa'] },
        { chainId: 10, assets: ['0xbbb'] },
      ],
    })
    const second = getWalletAssetsQueryScope({
      ...base,
      multiChain: true,
      assetFilter: [{ chainId: 8453, assets: ['0xaaa', '0xbbb'] }],
    })

    expect(hashQueryKey(first.queryKey)).not.toBe(hashQueryKey(second.queryKey))
  })

  it('ignores missing runtime asset values instead of crashing the query key', () => {
    const scope = getWalletAssetsQueryScope({
      ...base,
      multiChain: true,
      assetFilter: [
        {
          chainId: 80002,
          assets: [undefined, '0xABC'] as unknown as string[],
        },
      ],
    })

    expect(scope.queryKey[2]).toMatchObject({
      assetFilter: [{ chainId: 80002, assets: ['0xabc'] }],
    })
  })

  it('ignores missing runtime asset values in a single-chain query scope', () => {
    const scope = getWalletAssetsQueryScope({
      ...base,
      multiChain: false,
      assets: [undefined, '0xABC'] as unknown as string[],
    })

    expect(scope.queryKey[2]).toMatchObject({
      assets: ['0xabc'],
    })
  })

  it('isolates identical asset requests by Openfort client in a shared QueryClient', async () => {
    const firstQuery = getWalletAssetsQueryScope({ ...base, client: {} })
    const secondQuery = getWalletAssetsQueryScope({ ...base, client: {} })
    const queryClient = new QueryClient()
    let requestCount = 0

    const [first, second] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: firstQuery.queryKey,
        queryFn: async () => {
          requestCount += 1
          return 'first'
        },
      }),
      queryClient.fetchQuery({
        queryKey: secondQuery.queryKey,
        queryFn: async () => {
          requestCount += 1
          return 'second'
        },
      }),
    ])

    expect(requestCount).toBe(2)
    expect(first).toBe('first')
    expect(second).toBe('second')
  })

  it('keys asset fallbacks by effective backend and RPC configuration', () => {
    const baseline = getWalletAssetsQueryScope({
      ...base,
      multiChain: true,
      fallbackChains: [{ chainId: 8453, assets: ['0xaaa'], rpcUrl: 'https://rpc-a.example' }],
    })

    expect(hashQueryKey(baseline.queryKey)).not.toBe(
      hashQueryKey(
        getWalletAssetsQueryScope({
          ...base,
          multiChain: true,
          fallbackChains: [{ chainId: 8453, assets: ['0xaaa'], rpcUrl: 'https://rpc-b.example' }],
        }).queryKey
      )
    )
    expect(hashQueryKey(baseline.queryKey)).not.toBe(
      hashQueryKey(
        getWalletAssetsQueryScope({
          ...base,
          multiChain: true,
          backendUrl: 'https://api-alt.openfort.io',
          fallbackChains: [{ chainId: 8453, assets: ['0xaaa'], rpcUrl: 'https://rpc-a.example' }],
        }).queryKey
      )
    )
  })

  it('never copies endpoint credentials into asset query keys', () => {
    const singleChainScope = getWalletAssetsQueryScope({
      ...base,
      backendUrl: 'https://api-key:backend-secret@api.example/rpc?token=backend-token',
      rpcUrl: 'https://rpc.example/tenant/rpc-secret',
    })
    const multiChainScope = getWalletAssetsQueryScope({
      ...base,
      multiChain: true,
      backendUrl: 'https://api-key:backend-secret@api.example/rpc?token=backend-token',
      fallbackChains: [
        {
          chainId: 8453,
          assets: ['0xaaa'],
          rpcUrl: 'https://rpc-user:rpc-password@fallback.example?key=fallback-secret',
        },
      ],
    })
    const serializedKey = JSON.stringify([singleChainScope.queryKey, multiChainScope.queryKey])

    expect(serializedKey).not.toContain('backend-secret')
    expect(serializedKey).not.toContain('backend-token')
    expect(serializedKey).not.toContain('rpc-secret')
    expect(serializedKey).not.toContain('rpc-password')
    expect(serializedKey).not.toContain('fallback-secret')
  })
})
