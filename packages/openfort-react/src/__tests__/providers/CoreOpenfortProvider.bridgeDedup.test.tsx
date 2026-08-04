import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, render, waitFor } from '@testing-library/react'
import type React from 'react'
import { createElement, useContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from 'zustand'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import { StoreContext } from '../../openfort/context.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'
import { createMockOpenfortClient, type MockOpenfortClient } from '../mocks/openfortClient.js'

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
vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => stableUseOpenfort
  return { useOpenfort: hook, useOpenfortConfig: hook, useOpenfortRouting: hook }
})

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
    getConnectors: () => [],
    initProvider: initProviderSpy,
    disconnect: disconnectSpy,
  }),
}))

const { OpenfortEthereumBridgeContext } = await import('../../ethereum/OpenfortEthereumBridgeContext.js')
const { CoreOpenfortProvider } = await import('../../openfort/CoreOpenfortProvider.js')

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

function renderWithBridge(bridge: OpenfortEthereumBridgeValue, child = createElement('div')) {
  return render(
    createElement(
      OpenfortEthereumBridgeContext.Provider,
      { value: bridge },
      createElement(CoreOpenfortProvider, { openfortConfig }, child)
    )
  )
}

function StoreReaderInner({
  store,
  onValue,
}: {
  store: NonNullable<React.ContextType<typeof StoreContext>>
  onValue: (value: any) => void
}) {
  onValue(useStore(store))
  return null
}

function StoreReader({ onValue }: { onValue: (value: any) => void }) {
  const store = useContext(StoreContext)
  return store ? createElement(StoreReaderInner, { store, onValue }) : null
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
    expect(initProviderSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      1,
      expect.objectContaining({ assertCurrent: expect.any(Function) })
    )

    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue({ chainId: 137 }))
    })

    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(2))
    expect(initProviderSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      137,
      expect.objectContaining({ assertCurrent: expect.any(Function) })
    )
  })

  it('queues a chain change that arrives while initialization is in progress', async () => {
    let finishFirstInit: (() => void) | undefined
    initProviderSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirstInit = resolve
        })
    )
    const result = renderWithBridge(makeBridgeValue({ chainId: 1 }))

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })
    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(1))

    await act(async () => {
      rerenderWithBridge(result, makeBridgeValue({ chainId: 137 }))
      finishFirstInit?.()
    })

    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledTimes(2))
    expect(initProviderSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      137,
      expect.objectContaining({ assertCurrent: expect.any(Function) })
    )
  })

  it('serializes provider initialization with other client signer operations', async () => {
    // This case isolates queue ordering; principal-transition invalidation is covered by
    // CoreOpenfortProvider.test.tsx.
    mockClient.user.get.mockResolvedValue(null as never)
    let releaseSignerOperation: (() => void) | undefined
    const signerOperation = runEmbeddedSignerOperation(
      mockClient as unknown as Parameters<typeof runEmbeddedSignerOperation>[0],
      () =>
        new Promise<void>((resolve) => {
          releaseSignerOperation = resolve
        })
    )
    renderWithBridge(makeBridgeValue())

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
      await Promise.resolve()
    })
    expect(initProviderSpy).not.toHaveBeenCalled()

    await act(async () => {
      releaseSignerOperation?.()
      await signerOperation
    })
    await waitFor(() => expect(initProviderSpy).toHaveBeenCalledOnce())
  })

  it('disconnects and resets the bridge once when logout emits unauthenticated state', async () => {
    const bridge = makeBridgeValue()
    let storeValue: any = null
    mockClient.auth.logout.mockImplementationOnce(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    renderWithBridge(bridge, createElement(StoreReader, { onValue: (value: any) => (storeValue = value) }))
    await waitFor(() => expect(storeValue).not.toBeNull())

    await act(async () => storeValue.logout())

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(bridge.disconnect).toHaveBeenCalledOnce()
    expect(bridge.reset).toHaveBeenCalledOnce()
  })

  it('retains delayed-event ownership when bridge cleanup fails after SDK logout', async () => {
    const bridge = makeBridgeValue()
    const disconnectError = new Error('bridge disconnect failed')
    vi.mocked(bridge.disconnect).mockRejectedValueOnce(disconnectError)
    let storeValue: any = null
    renderWithBridge(bridge, createElement(StoreReader, { onValue: (value: any) => (storeValue = value) }))
    await waitFor(() => expect(storeValue).not.toBeNull())

    await act(async () => {
      await expect(storeValue.logout()).rejects.toBe(disconnectError)
    })
    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(bridge.disconnect).toHaveBeenCalledOnce()
  })
})
