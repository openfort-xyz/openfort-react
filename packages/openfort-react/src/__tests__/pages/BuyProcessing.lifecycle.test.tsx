import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageActivityProvider } from '../../components/Common/Modal/pageActivity.js'

const asset = {
  type: 'native' as const,
  metadata: { name: 'Ether', symbol: 'ETH', decimals: 18 },
}

const h = vi.hoisted(() => ({
  createCoinbaseSession: vi.fn(),
  setRoute: vi.fn(),
  triggerResize: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({
    buyForm: { amount: '25', asset, currency: 'USD', providerId: 'coinbase' },
    publishableKey: 'pk_test_browser',
    setRoute: h.setRoute,
    triggerResize: h.triggerResize,
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { chainType: ChainTypeEnum }) => unknown) =>
    selector({ chainType: ChainTypeEnum.EVM }),
}))

vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: 'connected',
    address: '0x0000000000000000000000000000000000000001',
    chainId: 8453,
  }),
}))

vi.mock('../../solana/hooks/useSolanaEmbeddedWallet.js', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'disconnected' }),
}))

vi.mock('../../ethereum/hooks/useEthereumWalletAssets.js', () => ({
  useEthereumWalletAssets: () => ({ data: [asset] }),
}))

vi.mock('../../components/Pages/Buy/coinbaseApi.js', () => ({
  createCoinbaseSession: h.createCoinbaseSession,
}))

vi.mock('../../components/Pages/Buy/stripeApi.js', () => ({
  createStripeSession: vi.fn(),
}))

vi.mock('../../components/PageContent/index.js', () => ({
  PageContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { default: BuyProcessing } = await import('../../components/Pages/BuyProcessing/index.js')

describe('BuyProcessing lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('closes its reserved popup and never navigates it after page deactivation', async () => {
    const session = deferred<{ onrampUrl: string }>()
    h.createCoinbaseSession.mockReturnValueOnce(session.promise)
    const popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true
      }),
      location: { href: 'about:blank' },
      opener: window,
    }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)

    const { rerender } = render(
      <PageActivityProvider active>
        <BuyProcessing />
      </PageActivityProvider>
    )
    await waitFor(() => expect(h.createCoinbaseSession).toHaveBeenCalledOnce())
    expect(open).toHaveBeenCalledOnce()

    rerender(
      <PageActivityProvider active={false}>
        <BuyProcessing />
      </PageActivityProvider>
    )
    expect(popup.close).toHaveBeenCalledOnce()

    await act(async () => session.resolve({ onrampUrl: 'https://pay.coinbase.com/checkout' }))

    expect(open).toHaveBeenCalledOnce()
    expect(popup.location.href).toBe('about:blank')
    expect(h.setRoute).not.toHaveBeenCalled()
  })

  it('closes its reserved popup and never navigates it after unmount', async () => {
    const session = deferred<{ onrampUrl: string }>()
    h.createCoinbaseSession.mockReturnValueOnce(session.promise)
    const popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true
      }),
      location: { href: 'about:blank' },
      opener: window,
    }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)

    const { unmount } = render(<BuyProcessing />)
    await waitFor(() => expect(h.createCoinbaseSession).toHaveBeenCalledOnce())
    unmount()
    expect(popup.close).toHaveBeenCalledOnce()

    await act(async () => session.resolve({ onrampUrl: 'https://pay.coinbase.com/checkout' }))

    expect(open).toHaveBeenCalledOnce()
    expect(popup.location.href).toBe('about:blank')
    expect(h.setRoute).not.toHaveBeenCalled()
  })

  it('does not report completion when the user closes a reserved blank popup', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const session = deferred<{ onrampUrl: string }>()
      h.createCoinbaseSession.mockReturnValueOnce(session.promise)
      const popup = {
        closed: false,
        close: vi.fn(() => {
          popup.closed = true
        }),
        location: { href: 'about:blank' },
        opener: window,
      }
      vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)

      render(<BuyProcessing />)
      await waitFor(() => expect(h.createCoinbaseSession).toHaveBeenCalledOnce())
      popup.closed = true

      await act(async () => session.resolve({ onrampUrl: 'https://pay.coinbase.com/checkout' }))
      act(() => vi.advanceTimersByTime(1000))

      expect(popup.location.href).toBe('about:blank')
      expect(h.setRoute).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
