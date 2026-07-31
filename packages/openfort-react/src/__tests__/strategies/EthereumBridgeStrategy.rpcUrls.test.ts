import { describe, expect, it, vi } from 'vitest'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import { createEthereumBridgeStrategy } from '../../core/strategies/EthereumBridgeStrategy.js'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext.js'

function makeBridge(transportByChain: Record<number, string>): OpenfortEthereumBridgeValue {
  return {
    account: { address: '0xabc', isConnected: false },
    chainId: Number(Object.keys(transportByChain)[0]),
    config: {
      chains: Object.keys(transportByChain).map((id) => ({ id: Number(id) })),
      getClient: ({ chainId }: { chainId: number }) => ({ transport: { url: transportByChain[chainId] } }),
    },
    disconnect: vi.fn(),
  } as unknown as OpenfortEthereumBridgeValue
}

function makeOpenfort() {
  const getEthereumProvider = vi.fn(async () => ({ request: vi.fn(async () => null) }))
  return {
    openfort: {
      embeddedWallet: { getEthereumProvider, get: vi.fn(async () => ({ chainId: 84532 })) },
    } as unknown as Parameters<ReturnType<typeof createEthereumBridgeStrategy>['initProvider']>[0],
    getEthereumProvider,
  }
}

describe('EthereumBridgeStrategy signer RPC endpoints', () => {
  it('prefers walletConfig.ethereum.rpcUrls over the wagmi transport URL per chain', async () => {
    const bridge = makeBridge({ 84532: 'http://127.0.0.1:8545', 80002: 'https://rpc-amoy.polygon.technology' })
    const strategy = createEthereumBridgeStrategy(bridge, [])
    const { openfort, getEthereumProvider } = makeOpenfort()
    const walletConfig = {
      ethereum: { rpcUrls: { 84532: 'https://sepolia.base.org' } },
    } as unknown as OpenfortWalletConfig

    await strategy.initProvider(openfort, walletConfig)

    expect(getEthereumProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        chains: { 84532: 'https://sepolia.base.org', 80002: 'https://rpc-amoy.polygon.technology' },
      })
    )
  })

  it('falls back to the wagmi transport URL when no rpcUrl is configured', async () => {
    const bridge = makeBridge({ 84532: 'https://sepolia.base.org' })
    const strategy = createEthereumBridgeStrategy(bridge, [])
    const { openfort, getEthereumProvider } = makeOpenfort()

    await strategy.initProvider(openfort, {} as OpenfortWalletConfig)

    expect(getEthereumProvider).toHaveBeenCalledWith(
      expect.objectContaining({ chains: { 84532: 'https://sepolia.base.org' } })
    )
  })
})
