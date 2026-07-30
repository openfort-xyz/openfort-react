import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  FundingClient,
  FundingSession,
  FundingTarget,
  PaymentMethodInput,
} from '../hooks/openfort/fundingClient.js'

// useFunding reads only uiConfig.fundingBaseUrl from useOpenfort; stub it so the
// hook resolves no default client and we inject a mock instead.
const mockUiConfig: { fundingBaseUrl?: string } = {}
vi.mock('../components/Openfort/useOpenfort', () => {
  const hook = () => ({ uiConfig: mockUiConfig })
  return { useOpenfort: hook, useOpenfortConfig: hook }
})

// No SDK funding namespace in tests — the injected client is used instead.
vi.mock('../openfort/useOpenfort', () => {
  const getState = () => ({ client: undefined })
  return { useOpenfortCore: (selector: (s: ReturnType<typeof getState>) => unknown) => selector(getState()) }
})

const { useFunding } = await import('../hooks/openfort/useFunding.js')

const target: FundingTarget = { chain: 'eip155:8453', currency: '0xUSDC', address: '0xdest' }
const paymentMethod: PaymentMethodInput = {
  type: 'evm',
  source: { chain: 'eip155:137', currency: '0xsrc', amount: '1000000' },
}

function makeSession(over: Partial<FundingSession> = {}): FundingSession {
  return {
    id: 'fnd_1',
    clientSecret: 'cs_1',
    target,
    status: 'requires_payment_method',
    amountUnits: null,
    metadata: null,
    externalId: null,
    createdAt: 0,
    expiresAt: 0,
    paymentMethod: null,
    ...over,
  }
}

function makeClient() {
  const create = vi.fn()
  const setPaymentMethod = vi.fn()
  const get = vi.fn()
  const payLink = vi.fn()
  const client: FundingClient = { sessions: { create, setPaymentMethod, get }, payLink }
  return { client, create, setPaymentMethod, get, payLink }
}

describe('useFunding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUiConfig.fundingBaseUrl = undefined
  })

  it('is available by default — fundingBaseUrl falls back to the backend', () => {
    // No fundingBaseUrl set and no SDK backend configured in tests, so it resolves
    // to the hardcoded api.openfort.io default and the rail is available.
    const { result } = renderHook(() => useFunding())
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.status).toBe('idle')
  })

  it('creates a session, sets the payment method, and surfaces a terminal status without polling', async () => {
    const { client, create, setPaymentMethod, get } = makeClient()
    create.mockResolvedValue(makeSession())
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useFunding({ client }))
    expect(result.current.isAvailable).toBe(true)

    await act(async () => {
      await result.current.fund(target, paymentMethod)
    })

    expect(create).toHaveBeenCalledWith({ target })
    expect(setPaymentMethod).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1', paymentMethod })
    expect(get).not.toHaveBeenCalled() // succeeded is terminal — no poll
    expect(result.current.status).toBe('succeeded')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('records an error when the backend call fails', async () => {
    const { client, create } = makeClient()
    create.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useFunding({ client }))
    await act(async () => {
      await expect(result.current.fund(target, paymentMethod)).rejects.toThrow('boom')
    })

    expect(result.current.error?.message).toBe('boom')
    expect(result.current.status).toBe('idle')
    expect(result.current.loading).toBe(false)
  })

  it('ignores a stale in-flight fund() when a newer one supersedes it', async () => {
    const { client, create, setPaymentMethod } = makeClient()
    create.mockResolvedValue(makeSession())

    let releaseStale: (s: FundingSession) => void = () => {}
    const stalePending = new Promise<FundingSession>((resolve) => {
      releaseStale = resolve
    })
    setPaymentMethod
      .mockImplementationOnce(() => stalePending) // first call hangs
      .mockResolvedValueOnce(makeSession({ id: 'fresh', status: 'succeeded' }))

    const { result } = renderHook(() => useFunding({ client }))

    let stale: Promise<unknown> = Promise.resolve()
    act(() => {
      stale = result.current.fund(target, paymentMethod).catch(() => {})
    })
    await act(async () => {
      await result.current.fund(target, paymentMethod) // newer call wins
    })
    expect(result.current.session?.id).toBe('fresh')

    await act(async () => {
      releaseStale(makeSession({ id: 'stale', status: 'bounced' }))
      await stale
    })
    expect(result.current.session?.id).toBe('fresh') // stale resolution did not clobber state
    expect(result.current.status).toBe('succeeded')
  })

  it('stops polling when the hook unmounts mid-flight', async () => {
    vi.useFakeTimers()
    try {
      const { client, create, setPaymentMethod, get } = makeClient()
      create.mockResolvedValue(makeSession())
      let release: (s: FundingSession) => void = () => {}
      setPaymentMethod.mockImplementation(() => new Promise<FundingSession>((r) => (release = r)))

      const { result, unmount } = renderHook(() => useFunding({ client }))
      await act(async () => {
        void result.current.fund(target, paymentMethod).catch(() => {})
        await Promise.resolve() // flush microtasks so setPaymentMethod is actually in flight
      })
      expect(setPaymentMethod).toHaveBeenCalledTimes(1)

      unmount()
      // Resolve with a NON-terminal status — an alive hook would start polling.
      await act(async () => {
        release(makeSession({ status: 'waiting_payment' }))
        await Promise.resolve()
      })
      await vi.advanceTimersByTimeAsync(30_000)

      expect(get).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates a bare session without setting a payment method or polling', async () => {
    const { client, create, setPaymentMethod, get } = makeClient()
    create.mockResolvedValue(makeSession())

    const { result } = renderHook(() => useFunding({ client }))
    let created: FundingSession | undefined
    await act(async () => {
      created = await result.current.createSession(target)
    })

    expect(create).toHaveBeenCalledWith({ target })
    expect(setPaymentMethod).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(created?.id).toBe('fnd_1')
    // A bare session doesn't touch hook state — it's only used to mint a pay-link.
    expect(result.current.session).toBeNull()
  })

  it('resolves a session-bound pay link through the client', async () => {
    const { client, payLink } = makeClient()
    payLink.mockResolvedValue('https://pay.coinbase.com/checkout')

    const { result } = renderHook(() => useFunding({ client }))
    let url = ''
    await act(async () => {
      url = await result.current.payLink({
        sessionId: 'fnd_1',
        clientSecret: 'cs_1',
        amount: '10',
        asset: 'USDC',
      })
    })

    expect(url).toBe('https://pay.coinbase.com/checkout')
    expect(payLink).toHaveBeenCalledWith({
      sessionId: 'fnd_1',
      clientSecret: 'cs_1',
      amount: '10',
      asset: 'USDC',
    })
  })

  it('reset() returns the hook to idle', async () => {
    const { client, create, setPaymentMethod } = makeClient()
    create.mockResolvedValue(makeSession())
    setPaymentMethod.mockResolvedValue(makeSession({ status: 'succeeded' }))

    const { result } = renderHook(() => useFunding({ client }))
    await act(async () => {
      await result.current.fund(target, paymentMethod)
    })
    expect(result.current.session).not.toBeNull()

    act(() => {
      result.current.reset()
    })
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
