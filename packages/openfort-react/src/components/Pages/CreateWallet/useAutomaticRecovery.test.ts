import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OtpRequiredError, WalletCreationError } from '../../../errors/wallet.js'
import { invalidatePersistentOperations } from '../../../shared/utils/persistentOperationRegistry.js'
import { PageActivityProvider } from '../../Common/Modal/pageActivity.js'
import { useAutomaticRecovery } from './useAutomaticRecovery.js'

const setRoute = vi.fn()
const triggerResize = vi.fn()
const requestOTP = vi.fn()
const registryOwner = vi.hoisted(() => ({}))
const captureAuthSession = vi.hoisted(() => vi.fn(() => ({ isCurrent: () => true })))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

vi.mock('../../Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({ setRoute, triggerResize }),
}))

vi.mock('../../../shared/hooks/useRecoveryOTP.js', () => ({
  useRecoveryOTP: () => ({ isEnabled: true, requestOTP }),
}))

vi.mock('../../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) => selector({ client: registryOwner }),
}))

vi.mock('../../../openfort/authTransitionContext.js', () => ({
  useAuthTransitions: () => ({ captureAuthSession }),
}))

describe('useAutomaticRecovery', () => {
  beforeEach(() => {
    invalidatePersistentOperations(registryOwner)
    vi.clearAllMocks()
    requestOTP.mockResolvedValue({ email: 't***@example.com' })
  })

  it('requests OTP instead of routing when create resolves an OTP-required error', async () => {
    const create = vi.fn().mockResolvedValue({ error: new OtpRequiredError({ canRequestOtp: true }) })
    const { result } = renderHook(() =>
      useAutomaticRecovery({
        chain: 'Ethereum',
        create,
        successRoute: { route: 'connected-success' },
        otpVerificationError: 'Invalid code',
        canCreate: true,
      })
    )

    act(() => result.current.startCreation())

    await waitFor(() => expect(result.current.needsOTP).toBe(true))
    expect(requestOTP).toHaveBeenCalledOnce()
    expect(setRoute).not.toHaveBeenCalled()
  })

  it('surfaces a resolved create error instead of routing', async () => {
    const error = new WalletCreationError({ chain: 'Solana' })
    const create = vi.fn().mockResolvedValue({ error })
    const { result } = renderHook(() =>
      useAutomaticRecovery({
        chain: 'Solana',
        create,
        successRoute: { route: 'sol-connected' },
        otpVerificationError: 'Invalid code',
        canCreate: true,
      })
    )

    act(() => result.current.startCreation())

    await waitFor(() => expect(result.current.recoveryError).toBe(error))
    expect(setRoute).not.toHaveBeenCalled()
  })

  it('keeps observing one creation attempt after the create dependency changes', async () => {
    const pending = deferred<{ account: { id: string } }>()
    const firstCreate = vi.fn().mockReturnValue(pending.promise)
    const secondCreate = vi.fn().mockResolvedValue({ account: { id: 'duplicate' } })
    const props = {
      chain: 'Ethereum' as const,
      successRoute: { route: 'connected-success' },
      otpVerificationError: 'Invalid code',
      canCreate: true,
    }
    const { result, rerender } = renderHook(({ create }) => useAutomaticRecovery({ ...props, create }), {
      initialProps: { create: firstCreate },
    })

    act(() => result.current.startCreation())
    await waitFor(() => expect(firstCreate).toHaveBeenCalledOnce())

    rerender({ create: secondCreate })
    expect(secondCreate).not.toHaveBeenCalled()

    await act(async () => pending.resolve({ account: { id: 'created' } }))
    await waitFor(() => expect(setRoute).toHaveBeenCalledOnce())
  })

  it('does not update or route after unmount while requesting the recovery code', async () => {
    const otp = deferred<{ email: string }>()
    requestOTP.mockReturnValueOnce(otp.promise)
    const create = vi.fn().mockResolvedValue({ error: new OtpRequiredError({ canRequestOtp: true }) })
    const { result, unmount } = renderHook(() =>
      useAutomaticRecovery({
        chain: 'Ethereum',
        create,
        successRoute: { route: 'connected-success' },
        otpVerificationError: 'Invalid code',
        canCreate: true,
      })
    )

    act(() => result.current.startCreation())
    await waitFor(() => expect(requestOTP).toHaveBeenCalledOnce())
    unmount()

    await act(async () => otp.resolve({ email: 't***@example.com' }))

    expect(setRoute).not.toHaveBeenCalled()
    expect(triggerResize).not.toHaveBeenCalled()
  })

  it('does not route when creation finishes after its page becomes inactive', async () => {
    const pending = deferred<{ account: { id: string } }>()
    const create = vi.fn().mockReturnValue(pending.promise)
    let active = true
    const wrapper = ({ children }: { children: ReactNode }) => createElement(PageActivityProvider, { active }, children)
    const { result, rerender } = renderHook(
      () =>
        useAutomaticRecovery({
          chain: 'Ethereum',
          create,
          successRoute: { route: 'connected-success' },
          otpVerificationError: 'Invalid code',
          canCreate: true,
        }),
      { wrapper }
    )

    act(() => result.current.startCreation())
    await waitFor(() => expect(create).toHaveBeenCalledOnce())

    active = false
    rerender()
    await act(async () => pending.resolve({ account: { id: 'created' } }))

    expect(setRoute).not.toHaveBeenCalled()
  })

  it('reobserves one creation after an inactive page becomes active again', async () => {
    const creation = deferred<{ account: { id: string } }>()
    const create = vi.fn().mockReturnValueOnce(creation.promise)
    let active = true
    const wrapper = ({ children }: { children: ReactNode }) => createElement(PageActivityProvider, { active }, children)
    const { result, rerender } = renderHook(
      () =>
        useAutomaticRecovery({
          chain: 'Ethereum',
          create,
          successRoute: { route: 'connected-success' },
          otpVerificationError: 'Invalid code',
          canCreate: true,
        }),
      { wrapper }
    )

    act(() => result.current.startCreation())
    await waitFor(() => expect(create).toHaveBeenCalledOnce())

    active = false
    rerender()
    await act(async () => creation.resolve({ account: { id: 'created' } }))
    expect(setRoute).not.toHaveBeenCalled()

    active = true
    rerender()

    await waitFor(() => expect(setRoute).toHaveBeenCalledWith({ route: 'connected-success' }))
    expect(create).toHaveBeenCalledOnce()
  })

  it('reobserves one OTP submission after an inactive page becomes active again', async () => {
    const verification = deferred<{ account: { id: string } }>()
    const create = vi.fn().mockReturnValueOnce(verification.promise)
    let active = true
    const wrapper = ({ children }: { children: ReactNode }) => createElement(PageActivityProvider, { active }, children)
    const { result, rerender } = renderHook(
      () =>
        useAutomaticRecovery({
          chain: 'Ethereum',
          create,
          successRoute: { route: 'connected-success' },
          otpVerificationError: 'Invalid code',
          canCreate: true,
        }),
      { wrapper }
    )

    act(() => {
      void result.current.submitOtp('123456789')
    })
    await waitFor(() => expect(create).toHaveBeenCalledOnce())

    active = false
    rerender()
    await act(async () => verification.resolve({ account: { id: 'created' } }))
    expect(setRoute).not.toHaveBeenCalled()

    active = true
    rerender()

    await waitFor(() => expect(setRoute).toHaveBeenCalledWith({ route: 'connected-success' }))
    expect(create).toHaveBeenCalledOnce()
    expect(result.current.otpStatus).toBe('success')
  })

  it('finishes an OTP submission after the create dependency changes', async () => {
    const pending = deferred<{ account: { id: string } }>()
    const firstCreate = vi.fn().mockReturnValue(pending.promise)
    const secondCreate = vi.fn().mockResolvedValue({ account: { id: 'duplicate' } })
    const props = {
      chain: 'Ethereum' as const,
      successRoute: { route: 'connected-success' },
      otpVerificationError: 'Invalid code',
      canCreate: true,
    }
    const { result, rerender } = renderHook(({ create }) => useAutomaticRecovery({ ...props, create }), {
      initialProps: { create: firstCreate },
    })

    act(() => {
      void result.current.submitOtp('123456789')
    })
    await waitFor(() => expect(firstCreate).toHaveBeenCalledOnce())

    rerender({ create: secondCreate })
    await act(async () => pending.resolve({ account: { id: 'created' } }))

    expect(secondCreate).not.toHaveBeenCalled()
    expect(setRoute).toHaveBeenCalledWith(props.successRoute)
    expect(result.current.otpStatus).toBe('success')
  })

  it('does not let resend supersede an in-flight OTP submission', async () => {
    const pendingCreate = deferred<{ account: { id: string } }>()
    const create = vi.fn().mockReturnValue(pendingCreate.promise)
    const successRoute = { route: 'connected-success' }
    const { result } = renderHook(() =>
      useAutomaticRecovery({
        chain: 'Ethereum',
        create,
        successRoute,
        otpVerificationError: 'Invalid code',
        canCreate: true,
      })
    )

    act(() => {
      void result.current.submitOtp('123456789')
    })
    await waitFor(() => expect(result.current.otpStatus).toBe('loading'))

    act(() => {
      result.current.resend.onClick()
    })

    expect(requestOTP).not.toHaveBeenCalled()
    expect(result.current.resend.disabled).toBe(true)

    await act(async () => pendingCreate.resolve({ account: { id: 'created' } }))

    await waitFor(() => expect(setRoute).toHaveBeenCalledWith(successRoute))
  })

  it('reobserves one resend result after the page becomes active again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const resend = deferred<{ sentTo: 'phone'; phone: string }>()
      const create = vi.fn().mockResolvedValue({ error: new OtpRequiredError({ canRequestOtp: true }) })
      let active = true
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(PageActivityProvider, { active }, children)
      const { result, rerender } = renderHook(
        () =>
          useAutomaticRecovery({
            chain: 'Ethereum',
            create,
            successRoute: { route: 'connected-success' },
            otpVerificationError: 'Invalid code',
            canCreate: true,
          }),
        { wrapper }
      )
      act(() => result.current.startCreation())
      await waitFor(() => expect(result.current.needsOTP).toBe(true))
      act(() => vi.advanceTimersByTime(10_000))
      requestOTP.mockReturnValueOnce(resend.promise)
      act(() => {
        void result.current.resend.onClick()
      })
      await waitFor(() => expect(requestOTP).toHaveBeenCalledTimes(2))

      active = false
      rerender()
      await act(async () => resend.resolve({ sentTo: 'phone', phone: '+15555550123' }))
      expect(result.current.otpResponse).not.toMatchObject({ phone: '+15555550123' })

      active = true
      rerender()

      await waitFor(() => expect(result.current.otpResponse).toMatchObject({ phone: '+15555550123' }))
      expect(requestOTP).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
