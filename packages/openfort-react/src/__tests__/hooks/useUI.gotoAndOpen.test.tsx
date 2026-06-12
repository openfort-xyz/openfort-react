import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types'

/**
 * Regression guard for gotoAndOpen (openWallets infinite-loading bug).
 *
 * OpenfortProvider.setOpen(true) resets the route to LOADING to clear stale
 * state. gotoAndOpen must therefore call setOpen BEFORE setRoute, and must
 * match route specs by route name (openWallets passes a fresh object literal,
 * so reference equality never matches). The mock below mirrors the provider's
 * reset-on-open semantics so the wrong call order fails the test.
 */

const state: { route: { route: string }; open: boolean } = { route: { route: routes.LOADING }, open: false }

const setRoute = vi.fn((r: string | { route: string }) => {
  state.route = typeof r === 'string' ? { route: r } : r
})
const setOpen = vi.fn((value: boolean) => {
  if (value) state.route = { route: routes.LOADING }
  state.open = value
})
const setConnector = vi.fn()

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    open: state.open,
    setOpen,
    setRoute,
    setConnector,
    connector: { id: '' },
    chainType: ChainTypeEnum.EVM,
  }),
}))
vi.mock('../../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({
    isLoading: false,
    user: null,
    needsRecovery: false,
    embeddedAccounts: undefined,
    activeEmbeddedAddress: undefined,
    embeddedState: EmbeddedState.UNAUTHENTICATED,
  }),
}))
vi.mock('../../core/ConnectionStrategyContext', () => ({ useConnectionStrategy: () => null }))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({ useEthereumBridge: () => null }))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({ status: 'disconnected' }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'disconnected' }),
}))

const { useUI } = await import('../../hooks/openfort/useUI')

describe('useUI gotoAndOpen', () => {
  beforeEach(() => {
    state.route = { route: routes.LOADING }
    state.open = false
    vi.clearAllMocks()
  })

  it('openWallets lands on CONNECTORS, not clobbered back to LOADING', () => {
    const { result } = renderHook(() => useUI())

    act(() => result.current.openWallets())

    expect(state.open).toBe(true)
    expect(state.route).toMatchObject({ route: routes.CONNECTORS, connectType: 'linkIfUserConnectIfNoUser' })
  })

  it('opens the modal before setting the route', () => {
    const { result } = renderHook(() => useUI())

    act(() => result.current.openWallets())

    const openOrder = setOpen.mock.invocationCallOrder[0]
    const routeOrder = setRoute.mock.invocationCallOrder[0]
    expect(openOrder).toBeLessThan(routeOrder)
  })

  it('falls back to PROVIDERS for routes not allowed while disconnected', () => {
    const { result } = renderHook(() => useUI())

    // CONNECTED is not in the disconnected allowlist
    act(() => result.current.openProfile())

    expect(state.open).toBe(true)
    expect(state.route).toMatchObject({ route: routes.PROVIDERS })
  })
})
