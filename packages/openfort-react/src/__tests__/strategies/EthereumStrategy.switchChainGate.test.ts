import { ChainTypeEnum } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEthereumBridgeStrategy } from '../../core/strategies/EthereumBridgeStrategy.js'
import { createEthereumEmbeddedStrategy } from '../../core/strategies/EthereumEmbeddedStrategy.js'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext.js'

function makeProvider() {
  const request = vi.fn(async (req: { method: string }) => {
    if (req.method === 'eth_accounts') return ['0xsigner']
    if (req.method === 'wallet_switchEthereumChain') return null
    return null
  })
  return { request }
}

function makeOpenfort(provider: ReturnType<typeof makeProvider>, walletState: 'missing' | 'sameChain' | 'otherChain') {
  const wallet =
    walletState === 'missing'
      ? null
      : { address: '0xActiveAccount', chainId: walletState === 'sameChain' ? 84532 : 1, id: 'acc_1' }
  const get = vi.fn(async () => {
    if (!wallet) throw new Error('No signer configured')
    return wallet
  })
  return {
    embeddedWallet: {
      getEthereumProvider: vi.fn(async () => provider),
      get,
    },
  } as unknown as Parameters<ReturnType<typeof createEthereumEmbeddedStrategy>['initProvider']>[0]
}

function makeBridge(chainId: number): OpenfortEthereumBridgeValue {
  return {
    account: { address: '0xabc', isConnected: true },
    chainId,
    config: {
      chains: [{ id: chainId }],
      getClient: () => ({ transport: { url: '' } }),
    },
    disconnect: vi.fn(),
  } as unknown as OpenfortEthereumBridgeValue
}

function switchCalls(provider: ReturnType<typeof makeProvider>) {
  return provider.request.mock.calls.filter(
    ([req]) => (req as { method: string }).method === 'wallet_switchEthereumChain'
  )
}

describe('Ethereum strategies — wallet_switchEthereumChain gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('EthereumEmbeddedStrategy', () => {
    it('skips switch when openfort.embeddedWallet.get() throws (signer not configured)', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'missing')
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('skips switch when wallet.chainId already matches target', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'sameChain')
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('fires switch when wallet exists and chainId differs', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'otherChain')
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(1)
      expect(switchCalls(provider)[0]?.[0]).toEqual({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      })
    })
  })

  describe('EthereumBridgeStrategy', () => {
    it('skips switch when openfort.embeddedWallet.get() throws (signer not configured)', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'missing')
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('skips switch when wallet.chainId already matches target', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'sameChain')
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('fires switch when wallet exists and chainId differs', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'otherChain')
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532)

      expect(switchCalls(provider)).toHaveLength(1)
    })
  })

  describe('ConnectionStrategy interface — chainType=EVM matches both', () => {
    it('returns chainType EVM for embedded strategy', () => {
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })
      expect(strategy.chainType).toBe(ChainTypeEnum.EVM)
    })

    it('returns chainType EVM for bridge strategy', () => {
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])
      expect(strategy.chainType).toBe(ChainTypeEnum.EVM)
    })
  })
})
