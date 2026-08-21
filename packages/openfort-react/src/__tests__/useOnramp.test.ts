import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FundingClient } from '../hooks/openfort/fundingClient'
import type { FundingSession, OnrampPaymentMethod } from '../hooks/openfort/useFunding'

const mockUiConfig: { fundingBaseUrl?: string; funding?: { country?: string } } = {}
vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({ uiConfig: mockUiConfig }),
}))
vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({ client: undefined }),
}))

const { useOnramp } = await import('../hooks/openfort/useOnramp')

const sessionRef = { id: 'fnd_1', clientSecret: 'cs_1' }

function onrampPm(over: Partial<OnrampPaymentMethod> = {}): OnrampPaymentMethod {
  return {
    type: 'onramp',
    method: 'card',
    angle: 'popup',
    url: 'https://crypto.link.com/s?x=1',
    fees: [],
    minAmount: null,
    ...over,
  }
}

function makeSession(over: Partial<FundingSession> = {}): FundingSession {
  return {
    id: 'fnd_1',
    clientSecret: 'cs_1',
    target: { chain: 'eip155:8453', currency: '0xUSDC', address: '0xdest' },
    status: 'waiting_payment',
    amountUnits: null,
    metadata: null,
    externalId: null,
    createdAt: 0,
    expiresAt: 0,
    paymentMethod: onrampPm(),
    ...over,
  }
}

function makeClient() {
  const setPaymentMethod = vi.fn()
  const get = vi.fn()
  const quote = vi.fn()
  const client = {
    sessions: { create: vi.fn(), setPaymentMethod, get, methods: vi.fn(), quote },
    payLink: vi.fn(),
  } satisfies FundingClient
  return { client, setPaymentMethod, get, quote }
}

describe('useOnramp', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUiConfig.fundingBaseUrl = undefined
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })
  afterEach(() => {
    openSpy.mockRestore()
    vi.useRealTimers()
  })

  it('commits the onramp payment method and opens the checkout popup', async () => {
    const { client, setPaymentMethod, get } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    await act(async () => {
      await result.current.open({ sourceAmount: '100.00', sourceCurrency: 'USD' })
    })

    expect(setPaymentMethod).toHaveBeenCalledWith('fnd_1', {
      clientSecret: 'cs_1',
      paymentMethod: {
        type: 'onramp',
        method: 'card',
        sourceAmount: '100.00',
        sourceCurrency: 'USD',
        redirectUrl: undefined,
        country: undefined,
      },
    })
    expect(openSpy).toHaveBeenCalledWith('https://crypto.link.com/s?x=1', 'openfort-onramp', expect.any(String))
    expect(get).not.toHaveBeenCalled() // terminal on commit — no poll
    expect(result.current.status).toBe('succeeded')
    expect(result.current.url).toBe('https://crypto.link.com/s?x=1')
  })

  it('accepts a resolved method row and forwards its method id', async () => {
    const { client, setPaymentMethod } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))
    const row = { method: 'bank_transfer', provider: 'stripe', angle: 'popup', label: 'ACH' } as const

    const { result } = renderHook(() => useOnramp(sessionRef, row, { client }))
    await act(async () => {
      await result.current.open()
    })
    expect(setPaymentMethod).toHaveBeenCalledWith(
      'fnd_1',
      expect.objectContaining({ paymentMethod: expect.objectContaining({ method: 'bank_transfer' }) })
    )
  })

  it("mode 'manual' exposes the url without presenting anything", async () => {
    const { client, setPaymentMethod } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client, mode: 'manual' }))
    await act(async () => {
      await result.current.open()
    })
    expect(openSpy).not.toHaveBeenCalled()
    expect(result.current.url).toBe('https://crypto.link.com/s?x=1')
  })

  it('native wallet pay forwards the verified PII, never popups, and exposes the mount url + angle', async () => {
    const { client, setPaymentMethod } = makeClient()
    setPaymentMethod.mockResolvedValue(
      makeSession({
        status: 'succeeded',
        paymentMethod: onrampPm({ method: 'apple_pay', angle: 'native', url: 'https://pay.coinbase.com/buy/1' }),
      })
    )

    const { result } = renderHook(() => useOnramp(sessionRef, 'apple_pay', { client }))
    await act(async () => {
      await result.current.open({
        sourceAmount: '50.00',
        sourceCurrency: 'USD',
        walletPay: {
          email: 'buyer@example.com',
          phoneNumber: '+14155550123',
          phoneNumberVerifiedAt: '2026-07-07T12:00:00.000Z',
          agreementAcceptedAt: '2026-07-07T12:01:00.000Z',
        },
      })
    })

    expect(setPaymentMethod).toHaveBeenCalledWith('fnd_1', {
      clientSecret: 'cs_1',
      paymentMethod: {
        type: 'onramp',
        method: 'apple_pay',
        sourceAmount: '50.00',
        sourceCurrency: 'USD',
        redirectUrl: undefined,
        country: undefined,
        email: 'buyer@example.com',
        phoneNumber: '+14155550123',
        phoneNumberVerifiedAt: '2026-07-07T12:00:00.000Z',
        agreementAcceptedAt: '2026-07-07T12:01:00.000Z',
      },
    })
    // Native is mounted in-page by the caller — the hook must not open a popup.
    expect(openSpy).not.toHaveBeenCalled()
    expect(result.current.angle).toBe('native')
    expect(result.current.url).toBe('https://pay.coinbase.com/buy/1')
  })

  it('polls the session to a terminal status — the popup is never the source of truth', async () => {
    vi.useFakeTimers()
    const { client, setPaymentMethod, get } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'waiting_payment' }))
    get
      .mockResolvedValueOnce(makeSession({ status: 'processing' }))
      .mockResolvedValueOnce(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    let done: Promise<FundingSession> | undefined
    act(() => {
      done = result.current.open()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(result.current.status).toBe('processing')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
      await done
    })
    expect(get).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1' })
    expect(result.current.status).toBe('succeeded')
  })

  it('surfaces a commit failure and stays recoverable', async () => {
    const { client, setPaymentMethod } = makeClient()
    setPaymentMethod.mockRejectedValue(new Error('No onramp provider covers card'))

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    await act(async () => {
      await expect(result.current.open()).rejects.toThrow('No onramp provider covers card')
    })
    expect(result.current.error?.message).toContain('No onramp provider')
    expect(result.current.status).toBe('idle')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('quote() prices the route with the session-scoped endpoint', async () => {
    const { client, quote } = makeClient()
    quote.mockResolvedValue({ destinationAmount: '98.20' })

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client, country: 'US' }))
    const priced = await result.current.quote({ sourceAmount: '100.00', sourceCurrency: 'USD' })

    expect(quote).toHaveBeenCalledWith('fnd_1', {
      clientSecret: 'cs_1',
      method: 'card',
      sourceAmount: '100.00',
      sourceCurrency: 'USD',
      country: 'US',
    })
    expect(priced.destinationAmount).toBe('98.20')
  })

  it('throws a clear error without a session or method', async () => {
    const { client } = makeClient()
    const { result } = renderHook(() => useOnramp(null, 'card', { client }))
    await expect(result.current.open()).rejects.toThrow(/needs a session and a method/)
  })

  it('flags the checkout closing and keeps polling — closing is not an outcome', async () => {
    vi.useFakeTimers()
    const { client, setPaymentMethod, get } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'waiting_payment' }))
    get.mockResolvedValue(makeSession({ status: 'waiting_payment' }))
    const fakeWindow = { closed: false } as Window
    openSpy.mockReturnValue(fakeWindow)

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    act(() => {
      void result.current.open().catch(() => {})
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(result.current.checkoutClosed).toBe(false)

    // The buyer shuts the checkout window.
    fakeWindow.closed = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(result.current.checkoutClosed).toBe(true)
    // Still non-terminal: settlement may land after the window is gone.
    expect(result.current.status).toBe('waiting_payment')

    const callsSoFar = get.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })
    expect(get.mock.calls.length).toBeGreaterThan(callsSoFar)
  })

  it('a close that follows settlement surfaces the succeeded status', async () => {
    vi.useFakeTimers()
    const { client, setPaymentMethod, get } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'waiting_payment' }))
    // The webhook lands while the buyer is still in the checkout window.
    get.mockResolvedValue(makeSession({ status: 'succeeded' }))
    const fakeWindow = { closed: false } as Window
    openSpy.mockReturnValue(fakeWindow)

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    act(() => {
      void result.current.open().catch(() => {})
    })
    fakeWindow.closed = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(result.current.status).toBe('succeeded')
  })

  it('present() reopens the committed checkout url', async () => {
    const { client, setPaymentMethod } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useOnramp(sessionRef, 'card', { client, mode: 'manual' }))
    await act(async () => {
      await result.current.open()
    })
    openSpy.mockClear()
    act(() => {
      result.current.present()
    })
    expect(openSpy).toHaveBeenCalledWith('https://crypto.link.com/s?x=1', 'openfort-onramp', expect.any(String))
  })

  it('stops polling when the hook unmounts mid-flight', async () => {
    vi.useFakeTimers()
    const { client, setPaymentMethod, get } = makeClient()
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'waiting_payment' }))
    get.mockResolvedValue(makeSession({ status: 'processing' })) // never terminal

    const { result, unmount } = renderHook(() => useOnramp(sessionRef, 'card', { client }))
    act(() => {
      void result.current.open().catch(() => {})
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    const callsAtUnmount = get.mock.calls.length
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(get.mock.calls.length).toBeLessThanOrEqual(callsAtUnmount + 1)
  })
})
