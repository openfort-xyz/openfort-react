import type { Openfort } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePhoneOtpAuth } from '../../hooks/openfort/auth/usePhoneOtpAuth.js'
import {
  captureAuthSession,
  reserveAuthenticatedMutation,
  reserveAuthTransition,
} from '../../shared/utils/authTransitionQueue.js'
import { createMockOpenfortClient } from '../mocks/openfortClient.js'
import { createStoreWrapper } from '../mocks/TestWrapper.js'

vi.mock('../../hooks/openfort/auth/useConnectToWalletPostAuth.js', () => ({
  useConnectToWalletPostAuth: () => ({ tryUseWallet: vi.fn(async () => ({})) }),
}))

describe('usePhoneOtpAuth authenticated transitions', () => {
  it('does not publish or notify after logout supersedes a blocked link', async () => {
    const client = createMockOpenfortClient()
    let releaseLink!: () => void
    const linkGate = new Promise<void>((resolve) => {
      releaseLink = resolve
    })
    client.auth.linkPhoneOtp.mockImplementationOnce(async () => {
      await linkGate
      return { user: { id: 'departing-user', linkedAccounts: [] } }
    })
    const openfort = client as unknown as Openfort
    const updateUser = vi.fn(async () => ({ id: 'departing-user', linkedAccounts: [] }))
    const onSuccess = vi.fn()
    const wrapper = createStoreWrapper({
      client: openfort,
      captureAuthSession: () => captureAuthSession(openfort),
      startAuthTransition: (mutation) => reserveAuthTransition(openfort, mutation),
      startAuthenticatedMutation: (mutation) => reserveAuthenticatedMutation(openfort, mutation),
      updateUser,
    })
    const { result } = renderHook(() => usePhoneOtpAuth(), { wrapper })

    let pendingLink!: ReturnType<typeof result.current.linkPhoneOtp>
    act(() => {
      pendingLink = result.current.linkPhoneOtp({ phoneNumber: '+15555550123', otp: '123456', onSuccess })
    })
    await vi.waitFor(() => expect(client.auth.linkPhoneOtp).toHaveBeenCalledOnce())
    const logout = reserveAuthTransition(openfort, () => client.auth.logout())

    let linkResult: Awaited<typeof pendingLink> | undefined
    await act(async () => {
      releaseLink()
      ;[linkResult] = await Promise.all([pendingLink, logout.result])
    })

    expect(linkResult).toMatchObject({
      error: {
        name: 'AuthenticationError',
        shortMessage: 'Authentication request was superseded by a newer request.',
      },
    })
    expect(updateUser).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(client.auth.logout).toHaveBeenCalledOnce()
  })
})
