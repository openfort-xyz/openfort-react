import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FundingError } from '../errors/funding.js'
import type {
  FundingClient,
  FundingSession,
  FundingTarget,
  PaymentMethodInput,
} from '../hooks/openfort/fundingClient.js'

// useFunding reads only uiConfig.fundingBaseUrl from useOpenfort; stub it so the
// hook resolves no default client and we inject a mock instead.
const mockUiConfig: { fundingBaseUrl?: string } = {}
const internal = vi.hoisted(() => ({
  client: {},
  captureAuthSession: vi.fn(() => ({ isCurrent: () => true })),
}))
vi.mock('../components/Openfort/useOpenfort.js', () => {
  const hook = () => ({ uiConfig: mockUiConfig })
  return { useOpenfort: hook, useOpenfortConfig: hook }
})

// No SDK funding namespace in tests — the injected client is used instead.
vi.mock('../openfort/useOpenfort.js', () => {
  const getState = () => ({ client: internal.client })
  return { useOpenfortCore: (selector: (s: ReturnType<typeof getState>) => unknown) => selector(getState()) }
})

vi.mock('../openfort/authTransitionContext.js', () => ({
  useAuthTransitions: () => ({ captureAuthSession: internal.captureAuthSession }),
}))

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
  const methods = vi.fn()
  const quote = vi.fn()
  const payLink = vi.fn()
  const client: FundingClient = { sessions: { create, setPaymentMethod, get, methods, quote }, payLink }
  return { client, create, setPaymentMethod, get, methods, quote, payLink }
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

    let actionResult: Awaited<ReturnType<typeof result.current.fund>> | undefined
    await act(async () => {
      actionResult = await result.current.fund(target, paymentMethod)
    })

    expect(create).toHaveBeenCalledWith({ target })
    expect(setPaymentMethod).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1', paymentMethod })
    expect(get).not.toHaveBeenCalled() // succeeded is terminal — no poll
    expect(result.current.status).toBe('succeeded')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(actionResult).toMatchObject({ session: { id: 'fnd_1' } })
  })

  it('resolves a typed error and isolates the consumer callback when the backend call fails', async () => {
    const { client, create } = makeClient()
    create.mockRejectedValue(new Error('boom'))
    const onError = vi.fn(() => {
      throw new Error('consumer callback failed')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { result } = renderHook(() => useFunding({ client, onError }))
      let actionResult: Awaited<ReturnType<typeof result.current.fund>> | undefined
      await act(async () => {
        actionResult = await result.current.fund(target, paymentMethod)
      })

      expect(actionResult).toMatchObject({ error: { name: 'FundingError', details: 'boom' } })
      expect(actionResult && 'error' in actionResult ? actionResult.error : null).toBeInstanceOf(FundingError)
      expect(result.current.error).toBeInstanceOf(FundingError)
      expect(result.current.status).toBe('idle')
      expect(result.current.loading).toBe(false)
      expect(onError).toHaveBeenCalledOnce()
    } finally {
      consoleError.mockRestore()
    }
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

    let stale: Promise<Awaited<ReturnType<typeof result.current.fund>>> = Promise.resolve({
      session: makeSession(),
    })
    act(() => {
      stale = result.current.fund(target, paymentMethod)
    })
    await vi.waitFor(() => expect(setPaymentMethod).toHaveBeenCalledOnce())
    await act(async () => {
      await result.current.fund(target, paymentMethod) // newer call wins
    })
    expect(result.current.session?.id).toBe('fresh')

    let staleResult: Awaited<ReturnType<typeof result.current.fund>> | undefined
    await act(async () => {
      releaseStale(makeSession({ id: 'stale', status: 'bounced' }))
      staleResult = await stale
    })
    expect(staleResult).toMatchObject({
      error: {
        name: 'FundingError',
        shortMessage: 'Funding request was superseded by a newer request.',
      },
    })
    expect(staleResult).not.toHaveProperty('session')
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
        void result.current.fund(target, paymentMethod)
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
    let created: Awaited<ReturnType<typeof result.current.createSession>> | undefined
    await act(async () => {
      created = await result.current.createSession(target)
    })

    expect(create).toHaveBeenCalledWith({ target })
    expect(setPaymentMethod).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(created).toMatchObject({ session: { id: 'fnd_1' } })
    // A bare session doesn't touch hook state — it's only used to mint a pay-link.
    expect(result.current.session).toBeNull()
  })

  it('resolves a session-bound pay link through the client', async () => {
    const { client, payLink } = makeClient()
    payLink.mockResolvedValue('https://pay.coinbase.com/checkout')

    const { result } = renderHook(() => useFunding({ client }))
    let payLinkResult: Awaited<ReturnType<typeof result.current.payLink>> | undefined
    await act(async () => {
      payLinkResult = await result.current.payLink({
        sessionId: 'fnd_1',
        clientSecret: 'cs_1',
        amount: '10',
        asset: 'USDC',
      })
    })

    expect(payLinkResult).toEqual({ url: 'https://pay.coinbase.com/checkout' })
    expect(payLink).toHaveBeenCalledWith({
      sessionId: 'fnd_1',
      clientSecret: 'cs_1',
      amount: '10',
      asset: 'USDC',
    })
  })

  it('resolves a typed error instead of publishing an untrusted pay-link URL', async () => {
    const { client, payLink } = makeClient()
    payLink.mockResolvedValue('javascript:alert(document.domain)')

    const { result } = renderHook(() => useFunding({ client }))
    let payLinkResult: Awaited<ReturnType<typeof result.current.payLink>> | undefined
    await act(async () => {
      payLinkResult = await result.current.payLink({
        sessionId: 'fnd_1',
        clientSecret: 'cs_1',
        amount: '10',
      })
    })

    expect(payLinkResult).toMatchObject({
      error: { name: 'FundingError', shortMessage: 'The coinbase funding URL has an untrusted origin.' },
    })
    expect(result.current.error).toBeInstanceOf(FundingError)
  })

  it('resolves typed errors from createSession, track, and payLink', async () => {
    const { client, create, get, payLink } = makeClient()
    create.mockRejectedValueOnce(new Error('create failed'))
    get.mockRejectedValueOnce(new Error('track failed'))
    payLink.mockRejectedValueOnce(new Error('pay link failed'))

    const { result } = renderHook(() => useFunding({ client }))
    let outcomes: unknown[] = []
    await act(async () => {
      outcomes = await Promise.all([
        result.current.createSession(target),
        result.current.track({ id: 'fnd_1', clientSecret: 'cs_1' }),
        result.current.payLink({ sessionId: 'fnd_1', clientSecret: 'cs_1', amount: '10' }),
      ])
    })

    expect(outcomes).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ name: 'FundingError', details: 'create failed' }) }),
      expect.objectContaining({ error: expect.objectContaining({ name: 'FundingError', details: 'track failed' }) }),
      expect.objectContaining({ error: expect.objectContaining({ name: 'FundingError', details: 'pay link failed' }) }),
    ])
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
