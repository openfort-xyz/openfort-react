import { beforeEach, describe, expect, it, vi } from 'vitest'
import { embeddedWalletConnector, setEmbeddedWalletProvider } from '../../wagmi/embeddedConnector'

type ConnectorConfig = Parameters<ReturnType<typeof embeddedWalletConnector>>[0]

const mainnet = { id: 1, name: 'Mainnet' }
const polygon = { id: 137, name: 'Polygon' }

function makeProvider() {
  const request = vi.fn(async (req: { method: string }) => {
    if (req.method === 'eth_chainId') return '0x1'
    return null
  })
  return { request, on: vi.fn(), removeListener: vi.fn() }
}

function makeConfig() {
  const emit = vi.fn()
  const config = { emitter: { emit }, chains: [mainnet, polygon], storage: null }
  return { config: config as unknown as ConnectorConfig, emit }
}

function makeConnector(config: ConnectorConfig) {
  // createConnector returns the setup fn verbatim, so we can invoke it directly.
  return embeddedWalletConnector()(config)
}

describe('embeddedWalletConnector — switchChain', () => {
  beforeEach(() => setEmbeddedWalletProvider(null))

  it('switches the embedded provider to the target chain and emits change', async () => {
    const provider = makeProvider()
    setEmbeddedWalletProvider(provider as never)
    const { config, emit } = makeConfig()
    const connector = makeConnector(config)

    const chain = await connector.switchChain?.({ chainId: 137 })

    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    })
    expect(emit).toHaveBeenCalledWith('change', { chainId: 137 })
    expect(chain).toEqual(polygon)
  })

  it('throws when the target chain is not configured', async () => {
    setEmbeddedWalletProvider(makeProvider() as never)
    const connector = makeConnector(makeConfig().config)
    await expect(connector.switchChain?.({ chainId: 999 })).rejects.toThrow('not configured')
  })

  it('throws when no embedded provider is ready', async () => {
    setEmbeddedWalletProvider(null)
    const connector = makeConnector(makeConfig().config)
    await expect(connector.switchChain?.({ chainId: 1 })).rejects.toThrow('provider not ready')
  })
})
