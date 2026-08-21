import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FundingClient } from '../hooks/openfort/fundingClient.js'
import type { ResolvedFundingMethod } from '../hooks/openfort/useFunding.js'

const mockUiConfig: { fundingBaseUrl?: string; funding?: { country?: string } } = {}
vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({ uiConfig: mockUiConfig }),
}))
vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({ client: undefined }),
}))

const { useFundingMethods } = await import('../hooks/openfort/useFundingMethods.js')

const sessionRef = { id: 'fnd_1', clientSecret: 'cs_1' }
const cardRow: ResolvedFundingMethod = { method: 'card', provider: 'stripe', angle: 'popup', label: 'Card' }

function makeClient() {
  const methods = vi.fn()
  const client = {
    sessions: { create: vi.fn(), setPaymentMethod: vi.fn(), get: vi.fn(), methods, quote: vi.fn() },
    payLink: vi.fn(),
  } satisfies FundingClient
  return { client, methods }
}

describe('useFundingMethods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUiConfig.fundingBaseUrl = undefined
    mockUiConfig.funding = undefined
  })

  it('resolves the session-scoped rows and exposes the country', async () => {
    const { client, methods } = makeClient()
    methods.mockResolvedValue({ country: 'US', methods: [cardRow] })

    const { result } = renderHook(() => useFundingMethods(sessionRef, { client }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(methods).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1', country: undefined })
    expect(result.current.methods).toEqual([cardRow])
    expect(result.current.country).toBe('US')
    expect(result.current.error).toBeNull()
  })

  it('stays idle and empty without a session', () => {
    const { client, methods } = makeClient()
    const { result } = renderHook(() => useFundingMethods(null, { client }))
    expect(methods).not.toHaveBeenCalled()
    expect(result.current.methods).toEqual([])
    expect(result.current.loaded).toBe(false)
  })

  it('hides the rows on resolve failure — loaded with an empty list, never a fallback', async () => {
    const { client, methods } = makeClient()
    methods.mockRejectedValue(new Error('geo service down'))

    const { result } = renderHook(() => useFundingMethods(sessionRef, { client }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.methods).toEqual([])
    expect(result.current.error?.message).toBe('geo service down')
  })

  it('refresh() refetches after a failure', async () => {
    const { client, methods } = makeClient()
    methods.mockRejectedValueOnce(new Error('blip')).mockResolvedValueOnce({ country: 'US', methods: [cardRow] })

    const { result } = renderHook(() => useFundingMethods(sessionRef, { client }))
    await waitFor(() => expect(result.current.error).not.toBeNull())

    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.methods).toEqual([cardRow]))
    expect(result.current.error).toBeNull()
  })

  it('an explicit country option wins over uiConfig.funding.country', async () => {
    mockUiConfig.funding = { country: 'DE' }
    const { client, methods } = makeClient()
    methods.mockResolvedValue({ country: 'US', methods: [] })

    const { result } = renderHook(() => useFundingMethods(sessionRef, { client, country: 'US' }))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(methods).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1', country: 'US' })
  })

  it('falls back to the uiConfig.funding.country override', async () => {
    mockUiConfig.funding = { country: 'DE' }
    const { client, methods } = makeClient()
    methods.mockResolvedValue({ country: 'DE', methods: [] })

    const { result } = renderHook(() => useFundingMethods(sessionRef, { client }))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(methods).toHaveBeenCalledWith('fnd_1', { clientSecret: 'cs_1', country: 'DE' })
  })
})
