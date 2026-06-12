import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types'

/**
 * Watchdog test: the LOADING page must not spin forever. When no state
 * transition routes away (e.g. modal opened while signed out and the SDK
 * never settles), it falls back to a not-found page with a way back to
 * the sign-in screen.
 */

const setRoute = vi.fn()

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    setRoute,
    walletConfig: undefined,
    uiConfig: {},
    triggerResize: vi.fn(),
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))
vi.mock('../../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({
    user: null,
    isLoading: false,
    isLoadingAccounts: false,
    needsRecovery: false,
    embeddedState: EmbeddedState.UNAUTHENTICATED,
    chainType: ChainTypeEnum.EVM,
  }),
}))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({ useEthereumBridge: () => null }))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({ status: 'disconnected' }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'disconnected' }),
}))
vi.mock('../../hooks/openfort/auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn() }) }))
// FitText measures DOM sizes that jsdom cannot provide
vi.mock('../../components/Common/FitText', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { default: Loading } = await import('../../components/Pages/Loading')

describe('Loading page watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setRoute.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the spinner before the timeout elapses', () => {
    render(<Loading />)

    act(() => vi.advanceTimersByTime(5_000))

    expect(screen.queryByText(/taking longer than expected/i)).toBeNull()
  })

  it('falls back to not-found after the timeout instead of spinning forever', () => {
    render(<Loading />)

    act(() => vi.advanceTimersByTime(10_000))

    expect(screen.getByText(/taking longer than expected/i)).toBeTruthy()
  })

  it('"Back to sign in" routes to the providers (sign-in) page', () => {
    render(<Loading />)

    act(() => vi.advanceTimersByTime(10_000))
    fireEvent.click(screen.getByText('Back to sign in'))

    expect(setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })
})
