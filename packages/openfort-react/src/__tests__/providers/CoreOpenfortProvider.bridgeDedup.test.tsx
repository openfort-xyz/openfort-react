import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext'
import { createMockOpenfortClient, type MockOpenfortClient } from '../mocks/openfortClient'

let mockClient: MockOpenfortClient

vi.mock('../../openfort/core', () => ({
  createOpenfortClient: () => mockClient,
  setDefaultClient: () => {},
}))

// Stable references to prevent referential-identity churn from re-firing memos/effects.
const stableUseOpenfort = {
  walletConfig: { ethereum: {} },
  chainType: ChainTypeEnum.EVM,
  setChainType: () => {},
  uiConfig: { walletConnectName: undefined },
  open: false,
  route: null,
  connector: null,
}
vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => stableUseOpenfort,
}))

const stableEmptyConnectors: never[] = []
vi.mock('../../wallets/useExternalConnectors', () => ({
  mapBridgeConnectorsToWalletProps: () => stableEmptyConnectors,
}))

vi.mock('../../hooks/useConnectLifecycle', () => ({
  useConnectLifecycle: () => {},
}))

const initProviderSpy = vi.fn(() => Promise.resolve())
const disconnectSpy = vi.fn(() => Promise.resolve())

vi.mock('../../core/strategies/EthereumBridgeStrategy', () => ({
  createEthereumBridgeStrategy: () => ({
    kind: 'bridge',
    chainType: ChainTypeEnum.EVM,
    isConnected: () => true,
    getChainId: () => 1,
    getAddress: () => '0xabc',
    getConnectRoutes: () => ['embedded', 'external-wallets'],
    getConnectors: () => [],
    initProvider: initProviderSpy,
    disconnect: disconnectSpy,
  }),
}))

const { OpenfortEthereumBridgeContext } = await import('../../ethereum/OpenfortEthereumBridgeContext')
const { CoreOpenfortProvider } = await import('../../openfort/CoreOpenfortProvider')

function makeBridgeValue(overrides: { chainId?: number; address?: `0x${string}` } = {}): OpenfortEthereumBridgeValue {
  return {
    account: {
      address: overrides.address ?? '0xabc',
      chain: { id: overrides.chainId ?? 1, name: 'mainnet' },
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      connector: { id: 'metamask', name: 'MetaMask' },
    },
    chainId: overrides.chainId ?? 1,
    config: {
      chains: [{ id: 1 }, { id: 137 }],
      getClient: () => ({ transport: { url: '' } }),
    },
    disconnect: vi.fn(async () => {}),
    connect: vi.fn(),
    connectAsync: vi.fn(),
    reset: vi.fn(),
    connectors: [],
    switchChain: {
      chains: [{ id: 1, name: 'mainnet' }],
      switchChain: vi.fn(),
      switchChainAsync: vi.fn(),
      isPending: false,
      error: null,
    },
  }
}

const openfortConfig = { baseConfiguration: { publishableKey: 'pk_test_123' } }

function renderWithBridge(bridge: OpenfortEthereumBridgeValue) {
  return render(
    createElement(
      OpenfortEthereumBridgeContext.Provider,
      { value: bridge },
      createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div'))
    )
  )
}

function rerenderWithBridge(result: ReturnType<typeof render>, bridge: OpenfortEthereumBridgeValue) {
  result.rerender(
    createElement(
      OpenfortEthereumBridgeContext.Provider,
      { value: bridge },
      createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div'))
    )
  )
}

describe('CoreOpenfortProvider — bridge churn dedup', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockClient = createMockOpenfortClient()
    initProviderSpy.mockClear()
    disconnectSpy.mockClear()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('was not wrapped in act')) return
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    mockClient._test.reset()
  })

  it('initProvider runs once per chainId despite bridge value churn during wagmi hydration', async () => {
    const result = renderWithBridge(makeBridgeValue())

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })

    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(1))

    // Simulate walletClient hydrating → bridge value object identity changes,
    // but chainId is unchanged. Strategy is recreated; initProvider must dedup.
    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue())
    })

    // ENS hydrates → another bridge churn.
    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue())
    })

    // isReconnecting flag flips → another bridge churn.
    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue())
    })

    // Allow any pending microtasks/effects to flush before final assertion.
    await new Promise((r) => setTimeout(r, 10))

    expect(initProviderSpy).toHaveBeenCalledTimes(1)
  })

  it('initProvider re-runs when chainId actually changes', async () => {
    const result = renderWithBridge(makeBridgeValue({ chainId: 1 }))

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })

    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(1))
    expect(initProviderSpy).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 1)

    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue({ chainId: 137 }))
    })

    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(2))
    expect(initProviderSpy).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 137)
  })
})
