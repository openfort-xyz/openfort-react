import { ChainTypeEnum } from '@openfort/openfort-js'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types'

/**
 * When no WalletConnect projectId is configured (missing env variable),
 * WalletConnect-dependent pages must show a clear configuration message
 * with a way back to sign-in — not an infinite spinner.
 */

const setRoute = vi.fn()

let bridgeValue: { connectors: { id: string }[] } | null = null

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    setRoute,
    setConnector: vi.fn(),
    connector: { id: 'metaMask' },
    chainType: ChainTypeEnum.EVM,
    uiConfig: {},
    triggerResize: vi.fn(),
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({ useEthereumBridge: () => bridgeValue }))
vi.mock('../../openfort/useOpenfort', () => ({ useOpenfortCore: () => ({ user: null }) }))
vi.mock('../../core/ConnectionStrategyContext', () => ({ useConnectionStrategy: () => null }))
vi.mock('../../hooks/openfort/auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn() }) }))
// FitText measures DOM sizes that jsdom cannot provide
vi.mock('../../components/Common/FitText', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { default: WalletConnectNotConfigured, useHasWalletConnect } = await import(
  '../../components/Common/WalletConnectNotConfigured'
)
const { default: MobileConnectors } = await import('../../components/Pages/MobileConnectors')

describe('useHasWalletConnect', () => {
  it('is false without a bridge (embedded-only)', () => {
    bridgeValue = null
    const { result } = renderHook(() => useHasWalletConnect())
    expect(result.current).toBe(false)
  })

  it('is false when no walletConnect connector is configured', () => {
    bridgeValue = { connectors: [{ id: 'coinbaseWalletSDK' }, { id: 'injected' }] }
    const { result } = renderHook(() => useHasWalletConnect())
    expect(result.current).toBe(false)
  })

  it('is true when a walletConnect connector exists', () => {
    bridgeValue = { connectors: [{ id: 'walletConnect' }] }
    const { result } = renderHook(() => useHasWalletConnect())
    expect(result.current).toBe(true)
  })
})

describe('WalletConnectNotConfigured page', () => {
  beforeEach(() => {
    setRoute.mockClear()
  })

  it('shows end-user copy without developer config details', () => {
    render(<WalletConnectNotConfigured />)

    expect(screen.getByText('Wallet connections unavailable')).toBeTruthy()
    expect(screen.getByText(/another sign-in method/i)).toBeTruthy()
    // env-var / projectId speak must not reach end users
    expect(screen.queryByText(/environment variable|project ID/i)).toBeNull()
  })

  it('warns the developer in the console with the config hint', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<WalletConnectNotConfigured />)

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('walletConnectProjectId'))
    warnSpy.mockRestore()
  })

  it('"Back to sign in" routes to the providers (sign-in) page', () => {
    render(<WalletConnectNotConfigured />)

    fireEvent.click(screen.getByText('Back to sign in'))

    expect(setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })
})

describe('MobileConnectors without WalletConnect', () => {
  it('shows the configuration page instead of the wallet list', () => {
    bridgeValue = { connectors: [{ id: 'injected' }] }

    render(<MobileConnectors />)

    expect(screen.getByText('Wallet connections unavailable')).toBeTruthy()
  })
})
