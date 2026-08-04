import { ChainTypeEnum } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEthereumBridgeStrategy } from '../../core/strategies/EthereumBridgeStrategy.js'
import { createEthereumEmbeddedStrategy } from '../../core/strategies/EthereumEmbeddedStrategy.js'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import type { EmbeddedSignerOperationContext } from '../../shared/utils/embeddedSignerOperationQueue.js'

const currentOperation: EmbeddedSignerOperationContext = { assertCurrent: () => undefined }

function invalidatableOperation() {
  const invalidated = new Error('signer operation invalidated')
  let current = true
  return {
    context: {
      assertCurrent: () => {
        if (!current) throw invalidated
      },
    } satisfies EmbeddedSignerOperationContext,
    invalidate: () => {
      current = false
    },
    invalidated,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

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

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('skips switch when wallet.chainId already matches target', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'sameChain')
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('fires switch when wallet exists and chainId differs', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'otherChain')
      const strategy = createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

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

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('skips switch when wallet.chainId already matches target', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'sameChain')
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('fires switch when wallet exists and chainId differs', async () => {
      const provider = makeProvider()
      const openfort = makeOpenfort(provider, 'otherChain')
      const strategy = createEthereumBridgeStrategy(makeBridge(84532), [])

      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)

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

  describe.each(['embedded', 'bridge'] as const)('%s strategy auth-boundary guards', (kind) => {
    const makeStrategy = () =>
      kind === 'embedded'
        ? createEthereumEmbeddedStrategy({ ethereum: { chainId: 84532 } })
        : createEthereumBridgeStrategy(makeBridge(84532), [])

    it('does not inspect the signer when provider acquisition crosses the boundary', async () => {
      const provider = makeProvider()
      const updateFeeSponsorship = vi.fn()
      Object.assign(provider, { updateFeeSponsorship })
      const providerGate = deferred<typeof provider>()
      const get = vi.fn().mockResolvedValue({ address: '0xActiveAccount', chainId: 1 })
      const announced = vi.fn()
      window.addEventListener('eip6963:announceProvider', announced)
      const getEthereumProvider = vi.fn(async (options?: { announceProvider?: boolean; feeSponsorship?: string }) => {
        const resolvedProvider = await providerGate.promise
        if (options?.feeSponsorship) updateFeeSponsorship(options.feeSponsorship)
        if (options?.announceProvider !== false) {
          window.dispatchEvent(new CustomEvent('eip6963:announceProvider'))
        }
        return resolvedProvider
      })
      const openfort = { embeddedWallet: { getEthereumProvider, get } } as unknown as Parameters<
        ReturnType<typeof makeStrategy>['initProvider']
      >[0]
      const operation = invalidatableOperation()
      const initialization = makeStrategy().initProvider(
        openfort,
        { ethereum: { chainId: 84532, ethereumFeeSponsorshipId: 'policy-stale' } },
        84532,
        operation.context
      )
      await vi.waitFor(() => expect(getEthereumProvider).toHaveBeenCalledOnce())

      operation.invalidate()
      providerGate.resolve(provider)

      await expect(initialization).rejects.toBe(operation.invalidated)
      expect(getEthereumProvider).toHaveBeenCalledWith(expect.objectContaining({ announceProvider: false }))
      expect(getEthereumProvider.mock.calls[0]?.[0]).not.toHaveProperty('feeSponsorship')
      expect(updateFeeSponsorship).not.toHaveBeenCalled()
      expect(announced).not.toHaveBeenCalled()
      expect(get).not.toHaveBeenCalled()
      expect(switchCalls(provider)).toHaveLength(0)
      window.removeEventListener('eip6963:announceProvider', announced)
    })

    it('commits sponsorship and announcement only after safe provider acquisition', async () => {
      const provider = makeProvider()
      const updateFeeSponsorship = vi.fn()
      Object.assign(provider, { updateFeeSponsorship })
      const openfort = makeOpenfort(provider, 'sameChain')
      const announcements: CustomEvent[] = []
      const onAnnouncement = (event: Event) => {
        const announcement = event as CustomEvent
        if (announcement.detail?.provider === provider) announcements.push(announcement)
      }
      window.addEventListener('eip6963:announceProvider', onAnnouncement)
      const operation = invalidatableOperation()

      await makeStrategy().initProvider(
        openfort,
        { ethereum: { chainId: 84532, ethereumFeeSponsorshipId: 'policy-current' } },
        84532,
        operation.context
      )

      expect(updateFeeSponsorship).toHaveBeenCalledWith('policy-current')
      expect(announcements).toHaveLength(1)
      expect(announcements[0]).toMatchObject({ detail: { provider } })
      operation.invalidate()
      window.dispatchEvent(new CustomEvent('eip6963:requestProvider'))
      expect(announcements).toHaveLength(1)
      window.removeEventListener('eip6963:announceProvider', onAnnouncement)
    })

    it('does not switch chains when signer lookup crosses the boundary', async () => {
      const provider = makeProvider()
      const walletGate = deferred<{ address: string; chainId: number }>()
      const get = vi.fn(() => walletGate.promise)
      const openfort = {
        embeddedWallet: { getEthereumProvider: vi.fn().mockResolvedValue(provider), get },
      } as unknown as Parameters<ReturnType<typeof makeStrategy>['initProvider']>[0]
      const operation = invalidatableOperation()
      const initialization = makeStrategy().initProvider(
        openfort,
        { ethereum: { chainId: 84532 } },
        84532,
        operation.context
      )
      await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())

      operation.invalidate()
      walletGate.resolve({ address: '0xActiveAccount', chainId: 1 })

      await expect(initialization).rejects.toBe(operation.invalidated)
      expect(switchCalls(provider)).toHaveLength(0)
    })

    it('does not publish a completed switch after the boundary changes', async () => {
      const provider = makeProvider()
      const switchGate = deferred<null>()
      provider.request.mockImplementationOnce(() => switchGate.promise)
      const openfort = makeOpenfort(provider, 'otherChain')
      const strategy = makeStrategy()
      const operation = invalidatableOperation()
      const initialization = strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, operation.context)
      await vi.waitFor(() => expect(switchCalls(provider)).toHaveLength(1))

      operation.invalidate()
      switchGate.resolve(null)

      await expect(initialization).rejects.toBe(operation.invalidated)
      await strategy.initProvider(openfort, { ethereum: { chainId: 84532 } }, 84532, currentOperation)
      expect(switchCalls(provider)).toHaveLength(2)
    })
  })
})
