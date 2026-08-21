import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageActivityProvider } from '../../components/Common/Modal/pageActivity.js'
import { invalidatePersistentOperations } from '../../shared/utils/persistentOperationRegistry.js'

const h = vi.hoisted(() => ({
  client: {},
  captureAuthSession: vi.fn(() => ({ isCurrent: () => true })),
  createSession: vi.fn(),
  payLink: vi.fn(),
  track: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

vi.mock('../../assets/logos.js', () => ({
  default: {
    Coinbase: () => <span>Coinbase logo</span>,
    Binance: () => <span>Binance logo</span>,
  },
}))

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({ triggerResize: vi.fn(), publishableKey: 'pk_live_browser' }),
}))

vi.mock('../../utils/validation.js', () => ({
  getPublishableKeyEnvironment: () => 'live',
}))

vi.mock('../../hooks/openfort/useFundingTarget.js', () => ({
  useFundingTarget: () => ({ chain: 'eip155:8453', currency: '0x0000000000000000000000000000000000000002' }),
}))

vi.mock('../../hooks/openfort/useFunding.js', () => ({
  useFunding: () => ({
    isAvailable: true,
    createSession: h.createSession,
    payLink: h.payLink,
    track: h.track,
    status: 'idle',
  }),
}))

vi.mock('../../hooks/openfort/useFundingChains.js', () => ({
  useFundingChains: () => ({
    chains: [
      {
        id: 'eip155:8453',
        name: 'Base',
        currencies: [{ address: '0x0000000000000000000000000000000000000002', symbol: 'USDC' }],
      },
    ],
  }),
}))

vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({ address: '0x0000000000000000000000000000000000000001' }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (
    selector: (state: { client: object; embeddedAccounts: unknown[]; chainType: ChainTypeEnum }) => unknown
  ) => selector({ client: h.client, embeddedAccounts: [], chainType: ChainTypeEnum.EVM }),
}))

vi.mock('../../openfort/authTransitionContext.js', () => ({
  useAuthTransitions: () => ({ captureAuthSession: h.captureAuthSession }),
}))

vi.mock('../../hooks/useBalance.js', () => ({
  useInvalidateBalance: () => vi.fn(),
}))

vi.mock('../../components/PageContent/index.js', () => ({
  PageContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/Common/Tooltip/index.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/Pages/Deposit/TestnetNotice.js', () => ({
  TestnetNotice: () => null,
}))

const { default: DepositCex } = await import('../../components/Pages/DepositCex/index.js')

describe('DepositCex lifecycle', () => {
  beforeEach(() => {
    invalidatePersistentOperations(h.client)
    vi.clearAllMocks()
    h.createSession.mockResolvedValue({ session: { id: 'session_1', clientSecret: 'secret_1' } })
  })

  it('closes the pending popup and ignores a late pay-link after page deactivation', async () => {
    const link = deferred<{ url: string }>()
    h.payLink.mockReturnValueOnce(link.promise)
    const popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true
      }),
      location: { href: 'about:blank' },
      opener: window,
    }
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)

    const { rerender } = render(
      <PageActivityProvider active>
        <DepositCex />
      </PageActivityProvider>
    )
    const openCoinbase = await screen.findByRole('button', { name: /Open Coinbase/ })
    await waitFor(() => expect((openCoinbase as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(openCoinbase)
    await waitFor(() => expect(h.payLink).toHaveBeenCalledOnce())

    rerender(
      <PageActivityProvider active={false}>
        <DepositCex />
      </PageActivityProvider>
    )
    expect(popup.close).toHaveBeenCalledOnce()

    await act(async () => link.resolve({ url: 'https://pay.coinbase.com/checkout' }))

    expect(popup.location.href).toBe('about:blank')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('reattaches one pay-link after a full page unmount', async () => {
    const firstLink = deferred<{ url: string }>()
    h.payLink.mockReturnValueOnce(firstLink.promise)
    const firstPopup = {
      closed: false,
      close: vi.fn(() => {
        firstPopup.closed = true
      }),
      location: { href: 'about:blank' },
      opener: window,
    }
    const secondPopup = {
      closed: false,
      close: vi.fn(() => {
        secondPopup.closed = true
      }),
      location: { href: 'about:blank' },
      opener: window,
    }
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(firstPopup as unknown as Window)
      .mockReturnValueOnce(secondPopup as unknown as Window)

    const firstPage = render(
      <PageActivityProvider active>
        <DepositCex />
      </PageActivityProvider>
    )
    const openCoinbase = await screen.findByRole('button', { name: /Open Coinbase/ })
    await waitFor(() => expect((openCoinbase as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(openCoinbase)

    firstPage.unmount()
    expect(firstPopup.close).toHaveBeenCalledOnce()
    await act(async () => new Promise((resolve) => setTimeout(resolve, 260)))

    render(
      <PageActivityProvider active>
        <DepositCex />
      </PageActivityProvider>
    )
    const reopenedCoinbase = await screen.findByRole('button', { name: /Open Coinbase/ })
    await waitFor(() => expect((reopenedCoinbase as HTMLButtonElement).disabled).toBe(false))
    expect(h.createSession).toHaveBeenCalledOnce()
    fireEvent.click(reopenedCoinbase)
    expect(h.payLink).toHaveBeenCalledOnce()

    await act(async () => firstLink.resolve({ url: 'https://pay.coinbase.com/stale' }))
    await waitFor(() => expect(secondPopup.location.href).toBe('https://pay.coinbase.com/stale'))
    expect(h.track).toHaveBeenCalledOnce()
  })
})
