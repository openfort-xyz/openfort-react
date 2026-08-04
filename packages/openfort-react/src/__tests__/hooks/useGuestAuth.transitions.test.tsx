import type { Openfort } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuestAuth } from '../../hooks/openfort/auth/useGuestAuth.js'
import { reserveAuthTransition } from '../../shared/utils/authTransitionQueue.js'
import { createMockOpenfortClient } from '../mocks/openfortClient.js'
import { createStoreWrapper } from '../mocks/TestWrapper.js'

const tryUseWallet = vi.fn(async () => ({ wallet: undefined }))

vi.mock('../../hooks/openfort/auth/useConnectToWalletPostAuth.js', () => ({
  useConnectToWalletPostAuth: () => ({ tryUseWallet }),
}))

describe('useGuestAuth auth transitions', () => {
  beforeEach(() => {
    tryUseWallet.mockClear()
  })

  it('returns its local status to idle when logout supersedes a pending signup', async () => {
    const client = createMockOpenfortClient()
    let releaseSignup!: () => void
    const signupGate = new Promise<void>((resolve) => {
      releaseSignup = resolve
    })
    client.auth.signUpGuest.mockImplementationOnce(async () => {
      await signupGate
      return { user: { id: 'stale-user', linkedAccounts: [] } }
    })
    const startAuthTransition = <T,>(mutation: () => Promise<T>) =>
      reserveAuthTransition(client as unknown as Openfort, mutation)
    const updateUser = vi.fn(async (user) => user ?? null)
    const onSuccess = vi.fn()
    const wrapper = createStoreWrapper({
      client: client as unknown as Openfort,
      startAuthTransition,
      updateUser,
    })
    const { result } = renderHook(() => useGuestAuth({ onSuccess }), { wrapper })

    let pendingSignup!: ReturnType<typeof result.current.signUpGuest>
    act(() => {
      pendingSignup = result.current.signUpGuest()
    })
    expect(result.current.isLoading).toBe(true)
    const logout = startAuthTransition(async () => undefined)

    let signupResult: Awaited<typeof pendingSignup> | undefined
    await act(async () => {
      releaseSignup()
      ;[signupResult] = await Promise.all([pendingSignup, logout.result])
    })

    expect(signupResult).toMatchObject({
      error: {
        name: 'AuthenticationError',
        shortMessage: 'Authentication request was superseded by a newer request.',
      },
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not let an older signup reset the status owned by a newer signup', async () => {
    const client = createMockOpenfortClient()
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    client.auth.signUpGuest
      .mockImplementationOnce(async () => {
        await firstGate
        return { user: { id: 'first-user', linkedAccounts: [] } }
      })
      .mockResolvedValueOnce({ user: { id: 'second-user', linkedAccounts: [] } })
    const startAuthTransition = <T,>(mutation: () => Promise<T>) =>
      reserveAuthTransition(client as unknown as Openfort, mutation)
    const updateUser = vi.fn(async (user) => user ?? null)
    const firstSuccess = vi.fn()
    const secondSuccess = vi.fn()
    const wrapper = createStoreWrapper({
      client: client as unknown as Openfort,
      startAuthTransition,
      updateUser,
    })
    const { result } = renderHook(() => useGuestAuth(), { wrapper })

    let firstSignup!: ReturnType<typeof result.current.signUpGuest>
    let secondSignup!: ReturnType<typeof result.current.signUpGuest>
    act(() => {
      firstSignup = result.current.signUpGuest({ onSuccess: firstSuccess })
      secondSignup = result.current.signUpGuest({ onSuccess: secondSuccess })
    })

    expect(result.current.isLoading).toBe(true)
    let firstResult: Awaited<typeof firstSignup> | undefined
    await act(async () => {
      releaseFirst()
      ;[firstResult] = await Promise.all([firstSignup, secondSignup])
    })

    expect(firstResult).toMatchObject({ error: { name: 'AuthenticationError' } })
    expect(result.current.isSuccess).toBe(true)
    expect(firstSuccess).not.toHaveBeenCalled()
    expect(secondSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: 'second-user', linkedAccounts: [] } })
    )
    expect(updateUser).toHaveBeenCalledOnce()
    expect(updateUser).toHaveBeenCalledWith({ id: 'second-user', linkedAccounts: [] })
  })
})
