import type { Openfort } from '@openfort/openfort-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { base, baseSepolia, polygon, polygonAmoy } from 'wagmi/chains'
import { embeddedWalletConnector, setEmbeddedWalletProvider } from './embeddedConnector.js'

/**
 * The embedded account is restored from storage carrying its own `chainId`, so the
 * provider comes back on that chain after a reload. Connecting has to move the
 * provider onto the chain the application asked for, otherwise the account's chain
 * is reported to wagmi and the user's selection is replaced on every reload.
 */

type ProviderRequest = { method: string; params?: unknown }

const CHAINS = [polygonAmoy, base, polygon, baseSepolia] as const

/** The chain the restored account record happens to carry. */
const ACCOUNT_CHAIN_ID = polygon.id
/** The chain the application is on, as wagmi restored it. */
const SELECTED_CHAIN_ID = polygonAmoy.id

function createProvider(initialChainId: number) {
  let chainId = initialChainId
  const provider = {
    request: vi.fn(async ({ method, params }: ProviderRequest) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return ['0x1111111111111111111111111111111111111111']
      }
      if (method === 'eth_chainId') return `0x${chainId.toString(16)}`
      if (method === 'wallet_switchEthereumChain') {
        const [{ chainId: hex }] = params as [{ chainId: string }]
        chainId = Number(hex)
        return null
      }
      return null
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  }
  return { provider, currentChainId: () => chainId }
}

function createConnector() {
  const connectorFn = embeddedWalletConnector()
  return connectorFn({
    chains: CHAINS,
    emitter: { emit: vi.fn() } as never,
    storage: null as never,
    transports: {},
  } as never)
}

let client: Openfort

beforeEach(() => {
  client = { embeddedWallet: {} } as unknown as Openfort
  setEmbeddedWalletProvider(null)
})

describe('embedded connector chain selection', () => {
  test('moves the provider onto the requested chain instead of the account chain', async () => {
    const { provider, currentChainId } = createProvider(ACCOUNT_CHAIN_ID)
    setEmbeddedWalletProvider(provider as never, client)

    const result = await createConnector().connect({ chainId: SELECTED_CHAIN_ID })

    expect(result.chainId).toBe(SELECTED_CHAIN_ID)
    expect(currentChainId()).toBe(SELECTED_CHAIN_ID)
  })

  test('reports the provider chain when no chain is requested', async () => {
    const { provider, currentChainId } = createProvider(ACCOUNT_CHAIN_ID)
    setEmbeddedWalletProvider(provider as never, client)

    const result = await createConnector().connect({})

    expect(result.chainId).toBe(ACCOUNT_CHAIN_ID)
    expect(currentChainId()).toBe(ACCOUNT_CHAIN_ID)
  })

  test('ignores a requested chain that is not configured', async () => {
    const { provider, currentChainId } = createProvider(ACCOUNT_CHAIN_ID)
    setEmbeddedWalletProvider(provider as never, client)

    const result = await createConnector().connect({ chainId: 1234567 })

    expect(result.chainId).toBe(ACCOUNT_CHAIN_ID)
    expect(currentChainId()).toBe(ACCOUNT_CHAIN_ID)
  })

  test('stays connected on the provider chain when the switch fails', async () => {
    const { provider } = createProvider(ACCOUNT_CHAIN_ID)
    provider.request.mockImplementation(async ({ method }: ProviderRequest) => {
      if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111']
      if (method === 'eth_chainId') return `0x${ACCOUNT_CHAIN_ID.toString(16)}`
      if (method === 'wallet_switchEthereumChain') throw new Error('account not available on that chain')
      return null
    })
    setEmbeddedWalletProvider(provider as never, client)

    const result = await createConnector().connect({ chainId: SELECTED_CHAIN_ID })

    expect(result.chainId).toBe(ACCOUNT_CHAIN_ID)
    expect(result.accounts).toHaveLength(1)
  })

  test('does not switch when the provider is already on the requested chain', async () => {
    const { provider } = createProvider(SELECTED_CHAIN_ID)
    setEmbeddedWalletProvider(provider as never, client)

    const result = await createConnector().connect({ chainId: SELECTED_CHAIN_ID })

    expect(result.chainId).toBe(SELECTED_CHAIN_ID)
    expect(provider.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_switchEthereumChain' }))
  })
})
