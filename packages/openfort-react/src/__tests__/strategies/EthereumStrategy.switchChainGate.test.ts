import { ChainTypeEnum } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEthereumBridgeStrategy } from '../../core/strategies/EthereumBridgeStrategy'
import { createEthereumEmbeddedStrategy } from '../../core/strategies/EthereumEmbeddedStrategy'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext'

function makeProvider() {
  const request = vi.fn(async (req: { method: string }) => {
    if (req.method === 'eth_accounts') return ['0xsigner']
    if (req.method === 'wallet_switchEthereumChain') return null
    return null
  })
  return { request }
}

function makeOpenfort(provider: ReturnType<typeof makeProvider>) {
  return {
    embeddedWallet: {
      getEthereumProvider: vi.fn(async () => provider),
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

describe('Ethereum strategies — wallet_switchEthereumChain gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('EthereumEmbeddedStrategy', () => {
    it('skips wallet_switchEthereumChain when activeEmbeddedAddress is undefined', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider)
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, undefined)

      const switchCalls = provider.request.mock.calls.filter(
        ([req]) => (req as { method: string }).method === 'wallet_switchEthereumChain'
      )
      expect(switchCalls).toHaveLength(0)
    })

    it('calls wallet_switchEthereumChain when activeEmbeddedAddress is set', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider)
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, '0xActiveAccount')

      const switchCalls = provider.request.mock.calls.filter(
        ([req]) => (req as { method: string }).method === 'wallet_switchEthereumChain'
      )
      expect(switchCalls).toHaveLength(1)
      expect(switchCalls[0]?.[0]).toEqual({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      })
    })
  })

  describe('EthereumBridgeStrategy', () => {
    it('skips wallet_switchEthereumChain when activeEmbeddedAddress is undefined', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider)
      const bridge = makeBridge(84532)
      const strategy = createEthereumBridgeStrategy(bridge, [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, undefined)

      const switchCalls = provider.request.mock.calls.filter(
        ([req]) => (req as { method: string }).method === 'wallet_switchEthereumChain'
      )
      expect(switchCalls).toHaveLength(0)
    })

    it('calls wallet_switchEthereumChain when activeEmbeddedAddress is set', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider)
      const bridge = makeBridge(84532)
      const strategy = createEthereumBridgeStrategy(bridge, [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, '0xActiveAccount')

      const switchCalls = provider.request.mock.calls.filter(
        ([req]) => (req as { method: string }).method === 'wallet_switchEthereumChain'
      )
      expect(switchCalls).toHaveLength(1)
    })
  })

  describe('ConnectionStrategy interface — chainType=EVM matches both', () => {
    it('returns chainType EVM for embedded strategy', () => {
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })
      expect(strategy.chainType).toBe(ChainTypeEnum.EVM)
    })

    it('returns chainType EVM for bridge strategy', () => {
      const bridge = makeBridge(84532)
      const strategy = createEthereumBridgeStrategy(bridge, [])
      expect(strategy.chainType).toBe(ChainTypeEnum.EVM)
    })
  })
})
