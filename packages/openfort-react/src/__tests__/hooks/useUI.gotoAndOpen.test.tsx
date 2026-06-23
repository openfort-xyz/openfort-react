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

const state: { route: { route: string }; open: boolean; connected: boolean } = {
  route: { route: routes.LOADING },
  open: false,
  connected: false,
}

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
  useEthereumEmbeddedWallet: () => ({ status: state.connected ? 'connected' : 'disconnected' }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ status: state.connected ? 'connected' : 'disconnected' }),
}))

const { useUI } = await import('../../hooks/openfort/useUI')

describe('useUI gotoAndOpen', () => {
  beforeEach(() => {
    state.route = { route: routes.LOADING }
    state.open = false
    state.connected = false
    vi.clearAllMocks()
  })

  it('openWallets lands on CONNECTORS, not clobbered back to LOADING', () => {
    const { result } = renderHook(() => useUI())

    act(() => result.current.openWallets())

    expect(state.open).toBe(true)
    expect(state.route).toMatchObject({ route: routes.CONNECTORS, connectType: 'linkIfUserConnectIfNoUser' })
  })

  it('falls back to PROVIDERS for routes not allowed while disconnected', () => {
    const { result } = renderHook(() => useUI())

    // CONNECTED is not in the disconnected allowlist
    act(() => result.current.openProfile())

    expect(state.open).toBe(true)
    expect(state.route).toMatchObject({ route: routes.PROVIDERS })
  })

  it('deep-link helpers fall back to PROVIDERS while disconnected', () => {
    const { result } = renderHook(() => useUI())

    // Connected-only destinations route the user through login first.
    for (const open of [
      result.current.openSend,
      result.current.openReceive,
      result.current.openFunding,
      result.current.openBuy,
      result.current.openExportKey,
      result.current.openSettings,
    ]) {
      act(() => open())
      expect(state.open).toBe(true)
      expect(state.route).toMatchObject({ route: routes.PROVIDERS })
    }
  })

  it('deep-link helpers navigate to their target route while connected', () => {
    state.connected = true
    const { result } = renderHook(() => useUI())

    const cases: [() => void, string][] = [
      [result.current.openSend, routes.SEND],
      [result.current.openReceive, routes.RECEIVE],
      [result.current.openFunding, routes.DEPOSIT],
      [result.current.openBuy, routes.BUY],
      [result.current.openExportKey, routes.EXPORT_KEY],
      [result.current.openSettings, routes.PROFILE],
    ]

    for (const [open, route] of cases) {
      act(() => open())
      expect(state.open).toBe(true)
      expect(state.route).toMatchObject({ route })
    }
  })
})
