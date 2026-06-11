import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, render } from '@testing-library/react'
import { createElement, useContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from 'zustand'
import { StoreContext } from '../../openfort/context'
import { createMockOpenfortClient, type MockOpenfortClient } from '../mocks/openfortClient'

let mockClient: MockOpenfortClient

// Mock the Openfort SDK constructor
vi.mock('../../openfort/core', () => ({
  createOpenfortClient: () => mockClient,
  setDefaultClient: () => {},
}))

// Mock heavy dependencies to avoid importing the entire component tree
vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    walletConfig: undefined,
    chainType: ChainTypeEnum.EVM,
    setChainType: () => {},
    uiConfig: { walletConnectName: undefined },
    open: false,
    route: null,
    connector: null,
  }),
}))
vi.mock('../../wallets/useExternalConnectors', () => ({
  mapBridgeConnectorsToWalletProps: () => [],
}))
vi.mock('../../hooks/useConnectLifecycle', () => ({
  useConnectLifecycle: () => {},
}))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({
  OpenfortEthereumBridgeContext: { Provider: ({ children }: any) => children },
}))

const { CoreOpenfortProvider } = await import('../../openfort/CoreOpenfortProvider')

function StoreReaderInner({ store, onValue }: { store: any; onValue: (v: any) => void }) {
  const state = useStore(store)
  onValue(state)
  return null
}

function StoreReader({ onValue }: { onValue: (v: any) => void }) {
  const store = useContext(StoreContext)
  if (!store) {
    onValue(null)
    return null
  }
  return createElement(StoreReaderInner, { store, onValue })
}

describe('CoreOpenfortProvider', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockClient = createMockOpenfortClient()
    // Suppress React act() warnings caused by async provider effects (user polling, account fetching)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('was not wrapped in act')) return
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    mockClient._test.reset()
  })

  const openfortConfig = {
    baseConfiguration: { publishableKey: 'pk_test_123' },
  }

  it('calls watchEmbeddedState on mount', async () => {
    await act(async () => {
      render(createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div')))
    })

    expect(mockClient.embeddedWallet.watchEmbeddedState).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.watchEmbeddedState).toHaveBeenCalledWith({
      onChange: expect.any(Function),
      onError: expect.any(Function),
    })
  })

  it('calls unwatch on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = render(createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div')))
      unmount = result.unmount
    })

    expect(mockClient._test.unwatchFn).not.toHaveBeenCalled()

    unmount!()

    expect(mockClient._test.unwatchFn).toHaveBeenCalledOnce()
  })

  it('provides embeddedState via store', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue).not.toBeNull()
    expect(storeValue.embeddedState).toBe(EmbeddedState.NONE)
  })

  it('updates store when watchEmbeddedState emits a state change', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.NONE)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.UNAUTHENTICATED)
  })

  it('transitions through multiple states correctly', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.UNAUTHENTICATED)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.READY)
  })

  it('logout clears user and embedded accounts', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    await act(async () => {
      await storeValue.logout()
    })

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(storeValue.user).toBeNull()
    expect(storeValue.embeddedAccounts).toBeUndefined()
    expect(storeValue.activeEmbeddedAddress).toBeUndefined()
  })

  it('store contains correct initial state and chainType', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue.user).toBeNull()
    expect(storeValue.chainType).toBe(ChainTypeEnum.EVM)
    expect(typeof storeValue.logout).toBe('function')
    expect(typeof storeValue.signUpGuest).toBe('function')
    expect(typeof storeValue.updateUser).toBe('function')
  })
})
