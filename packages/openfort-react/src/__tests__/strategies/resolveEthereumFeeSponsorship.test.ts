import { describe, expect, it, vi } from 'vitest'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import { createEthereumEmbeddedStrategy } from '../../core/strategies/EthereumEmbeddedStrategy'
import { resolveEthereumFeeSponsorship } from '../../core/strategyUtils'

const config = (ethereumFeeSponsorshipId: unknown): OpenfortWalletConfig =>
  ({ ethereum: { ethereumFeeSponsorshipId } }) as unknown as OpenfortWalletConfig

describe('resolveEthereumFeeSponsorship', () => {
  it('returns { feeSponsorship } for a string id (the key openfort-js expects, not { policy })', () => {
    const result = resolveEthereumFeeSponsorship(config('spon_123'), 84532)
    expect(result).toEqual({ feeSponsorship: 'spon_123' })
    // Regression guard: the original returned { policy }, which getEthereumProvider ignored.
    expect(result).not.toHaveProperty('policy')
  })

  it('resolves the per-chain id from a chainId->id map', () => {
    const result = resolveEthereumFeeSponsorship(config({ 84532: 'spon_base', 137: 'spon_polygon' }), 137)
    expect(result).toEqual({ feeSponsorship: 'spon_polygon' })
  })

  it('returns undefined when the active chain is absent from the map', () => {
    expect(resolveEthereumFeeSponsorship(config({ 137: 'spon_polygon' }), 84532)).toBeUndefined()
  })

  it('returns undefined when no sponsorship is configured', () => {
    expect(resolveEthereumFeeSponsorship(config(undefined), 84532)).toBeUndefined()
    expect(resolveEthereumFeeSponsorship(undefined, 84532)).toBeUndefined()
  })
})

describe('EthereumEmbeddedStrategy.initProvider sponsorship', () => {
  it('passes feeSponsorship (not policy) through to getEthereumProvider', async () => {
    const getEthereumProvider = vi.fn(async () => ({ request: vi.fn(async () => null) }))
    const openfort = {
      embeddedWallet: {
        getEthereumProvider,
        get: vi.fn(async () => null),
      },
    } as unknown as Parameters<ReturnType<typeof createEthereumEmbeddedStrategy>['initProvider']>[0]

    const walletConfig = config('spon_abc')
    const strategy = createEthereumEmbeddedStrategy(walletConfig)
    await strategy.initProvider(openfort, walletConfig, 84532)

    expect(getEthereumProvider).toHaveBeenCalledTimes(1)
    const arg = getEthereumProvider.mock.calls[0][0] as Record<string, unknown>
    expect(arg.feeSponsorship).toBe('spon_abc')
    expect(arg).not.toHaveProperty('policy')
  })
})
