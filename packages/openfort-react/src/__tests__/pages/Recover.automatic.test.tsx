import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageActivityProvider } from '../../components/Common/Modal/pageActivity.js'
import { routes } from '../../components/Openfort/types.js'
import { OtpRequiredError, RecoveryError } from '../../errors/wallet.js'
import { invalidatePersistentOperations } from '../../shared/utils/persistentOperationRegistry.js'

const wallet = {
  id: 'embedded_wallet_test',
  address: '0x0000000000000000000000000000000000000001',
  recoveryMethod: RecoveryMethod.AUTOMATIC,
  accounts: [{ id: 'account_test' }],
}

const setActive = vi.fn()
const setRoute = vi.fn()
const requestOTP = vi.fn()
const h = vi.hoisted(() => ({
  captureAuthSession: vi.fn(() => ({ isCurrent: () => true })),
  client: {},
  recoveryMethod: '' as RecoveryMethod,
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
    previousRoute: null,
    route: { route: routes.RECOVER_WALLET, wallet: { ...wallet, recoveryMethod: h.recoveryMethod } },
    setRoute,
    triggerResize: vi.fn(),
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      client: h.client,
      chainType: ChainTypeEnum.EVM,
      embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
    }),
}))

vi.mock('../../openfort/authTransitionContext.js', () => ({
  useAuthTransitions: () => ({ captureAuthSession: h.captureAuthSession }),
}))

vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({ setActive }),
}))

vi.mock('../../solana/hooks/useSolanaEmbeddedWallet.js', () => ({
  useSolanaEmbeddedWallet: () => ({ setActive: vi.fn() }),
}))

vi.mock('../../shared/hooks/useRecoveryOTP.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRecoveryOTP: () => ({ isEnabled: true, requestOTP }),
}))

vi.mock('../../hooks/openfort/auth/useSignOut.js', () => ({
  useSignOut: () => ({ signOut: vi.fn() }),
}))

vi.mock('../../hooks/useResolvedIdentity.js', () => ({
  useResolvedIdentity: () => ({ status: 'idle' }),
}))

vi.mock('../../components/Common/FitText/index.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/Common/Loading/index.js', () => ({
  default: ({ header }: { header: string }) => <div>{header}</div>,
}))

vi.mock('../../components/Common/OTPInput/index.js', () => ({
  OtpInputStandalone: ({
    onComplete,
    isLoading,
    isError,
    isSuccess,
  }: {
    onComplete: (otp: string) => void
    isLoading?: boolean
    isError?: boolean
    isSuccess?: boolean
  }) => (
    <button type="button" disabled={isLoading || isError || isSuccess} onClick={() => onComplete('123456789')}>
      Submit OTP
    </button>
  ),
}))

const { default: RecoverPage } = await import('../../components/Pages/Recover/index.js')

describe('automatic wallet recovery', () => {
  beforeEach(() => {
    invalidatePersistentOperations(h.client)
    vi.clearAllMocks()
    setActive.mockReset()
    requestOTP.mockReset()
    h.recoveryMethod = RecoveryMethod.AUTOMATIC
    requestOTP.mockResolvedValue({ sentTo: 'email', email: 't***@example.com' })
  })

  it('does not report or route success when OTP recovery resolves with an error', async () => {
    setActive
      .mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      .mockResolvedValueOnce({ error: new RecoveryError('Invalid code.') })
      .mockResolvedValueOnce({ needsRecovery: false })

    render(<RecoverPage />)

    await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))

    await waitFor(() => expect(screen.getByText(/Invalid code\./)).toBeTruthy())
    expect(screen.queryByText('Code verified successfully!')).toBeNull()
    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)

    await waitFor(
      () => expect((screen.getByRole('button', { name: 'Submit OTP' }) as HTMLButtonElement).disabled).toBe(false),
      { timeout: 3000 }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))

    await waitFor(() => expect(screen.getByText('Code verified successfully!')).toBeTruthy())
  })

  it('does not resend while OTP verification is in flight', async () => {
    const verification = deferred<{ needsRecovery: boolean }>()
    setActive
      .mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      .mockReturnValueOnce(verification.promise)

    render(<RecoverPage />)
    await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))
    const resend = screen.getByRole('button', { name: 'Code Sent!' })
    expect((resend as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(resend)

    expect(requestOTP).toHaveBeenCalledTimes(1)

    verification.resolve({ needsRecovery: false })
    await waitFor(() => expect(screen.getByText('Code verified successfully!')).toBeTruthy())
    expect(requestOTP).toHaveBeenCalledTimes(1)
  })

  it('requests another code, enforces the cooldown, and re-enables resend when it elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setActive.mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      render(<RecoverPage />)
      await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
      expect(requestOTP).toHaveBeenCalledOnce()
      const initialResend = screen.getByRole('button', { name: 'Code Sent!' }) as HTMLButtonElement
      expect(initialResend.disabled).toBe(true)
      fireEvent.click(initialResend)
      expect(requestOTP).toHaveBeenCalledOnce()

      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }))

      await waitFor(() => expect(requestOTP).toHaveBeenCalledTimes(2))
      expect((screen.getByRole('button', { name: 'Code Sent!' }) as HTMLButtonElement).disabled).toBe(true)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      const resend = screen.getByRole('button', { name: 'Resend Code' }) as HTMLButtonElement
      expect(resend.disabled).toBe(false)
      fireEvent.click(resend)
      await waitFor(() => expect(requestOTP).toHaveBeenCalledTimes(3))
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a rejected resend and allows the user to retry after the error clears', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setActive.mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      render(<RecoverPage />)
      await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      requestOTP.mockRejectedValueOnce(new Error('mailer unavailable'))

      fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }))

      await waitFor(() => expect(screen.getByText('Failed to send recovery code')).toBeTruthy())
      expect((screen.getByRole('button', { name: 'Code Sent!' }) as HTMLButtonElement).disabled).toBe(true)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(screen.queryByText('Failed to send recovery code')).toBeNull()
      expect((screen.getByRole('button', { name: 'Code Sent!' }) as HTMLButtonElement).disabled).toBe(true)
      act(() => {
        vi.advanceTimersByTime(9000)
      })
      const resend = screen.getByRole('button', { name: 'Resend Code' }) as HTMLButtonElement
      expect(resend.disabled).toBe(false)
      fireEvent.click(resend)
      await waitFor(() => expect(requestOTP).toHaveBeenCalledTimes(3))
      expect((screen.getByRole('button', { name: 'Code Sent!' }) as HTMLButtonElement).disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reobserves one OTP resend and publishes its result after reactivation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const resend = deferred<{ sentTo: 'phone'; phone: string }>()
      setActive.mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      const { rerender } = render(
        <PageActivityProvider active>
          <RecoverPage />
        </PageActivityProvider>
      )
      await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
      act(() => vi.advanceTimersByTime(10_000))
      requestOTP.mockReturnValueOnce(resend.promise)
      fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }))
      await waitFor(() => expect(requestOTP).toHaveBeenCalledTimes(2))

      rerender(
        <PageActivityProvider active={false}>
          <RecoverPage />
        </PageActivityProvider>
      )
      await act(async () => resend.resolve({ sentTo: 'phone', phone: '+15555550123' }))
      expect(screen.queryByText('+15555550123')).toBeNull()

      rerender(
        <PageActivityProvider active>
          <RecoverPage />
        </PageActivityProvider>
      )

      await waitFor(() => expect(screen.getByText('+15555550123')).toBeTruthy())
      expect(requestOTP).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not route when passkey recovery finishes after its page becomes inactive', async () => {
    const recovery = deferred<{ needsRecovery: boolean }>()
    h.recoveryMethod = RecoveryMethod.PASSKEY
    setActive.mockReturnValueOnce(recovery.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setActive).toHaveBeenCalledOnce())
    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )

    recovery.resolve({ needsRecovery: false })
    await Promise.resolve()

    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)
  })

  it('reobserves one passkey recovery when its preserved page becomes active again', async () => {
    const recovery = deferred<{ needsRecovery: boolean }>()
    h.recoveryMethod = RecoveryMethod.PASSKEY
    setActive.mockReturnValueOnce(recovery.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setActive).toHaveBeenCalledOnce())

    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )
    await act(async () => recovery.resolve({ needsRecovery: false }))
    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)

    rerender(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
    expect(setActive).toHaveBeenCalledOnce()
  })

  it('reobserves one automatic recovery without publishing the inactive observer', async () => {
    const recovery = deferred<{ needsRecovery: boolean }>()
    setActive.mockReturnValueOnce(recovery.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setActive).toHaveBeenCalledOnce())

    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )
    await act(async () => recovery.resolve({ needsRecovery: false }))

    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)

    rerender(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
    expect(setActive).toHaveBeenCalledOnce()
  })

  it('reobserves one OTP verification after its page becomes active again', async () => {
    const verification = deferred<{ needsRecovery: boolean }>()
    setActive
      .mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      .mockReturnValueOnce(verification.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))
    await waitFor(() => expect(setActive).toHaveBeenCalledTimes(2))

    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )
    await act(async () => verification.resolve({ needsRecovery: false }))
    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)

    rerender(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )

    await waitFor(() => expect(screen.getByText('Code verified successfully!')).toBeTruthy())
    expect(setActive).toHaveBeenCalledTimes(2)
  })

  it('retains one OTP request without publishing it until automatic recovery becomes active', async () => {
    const recovery = deferred<{ error: OtpRequiredError }>()
    setActive.mockReturnValueOnce(recovery.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(setActive).toHaveBeenCalledOnce())

    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )
    await act(async () => recovery.resolve({ error: new OtpRequiredError({ canRequestOtp: true }) }))

    expect(requestOTP).toHaveBeenCalledOnce()
    expect(screen.queryByText('Enter your code')).toBeNull()

    rerender(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )

    await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
    expect(setActive).toHaveBeenCalledOnce()
    expect(requestOTP).toHaveBeenCalledOnce()
  })

  it('does not publish OTP verification after its page becomes inactive', async () => {
    const verification = deferred<{ needsRecovery: boolean }>()
    setActive
      .mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
      .mockReturnValueOnce(verification.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <RecoverPage />
      </PageActivityProvider>
    )
    await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))
    await waitFor(() => expect(setActive).toHaveBeenCalledTimes(2))

    rerender(
      <PageActivityProvider active={false}>
        <RecoverPage />
      </PageActivityProvider>
    )
    await act(async () => verification.resolve({ needsRecovery: false }))

    expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)
    expect(screen.queryByText('Code verified successfully!')).toBeNull()
  })

  it('reopens OTP input when a verified page deactivates before delayed routing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setActive
        .mockResolvedValueOnce({ error: new OtpRequiredError({ canRequestOtp: true }) })
        .mockResolvedValueOnce({ needsRecovery: false })

      const { rerender } = render(
        <PageActivityProvider active>
          <RecoverPage />
        </PageActivityProvider>
      )
      await waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'Submit OTP' }))
      await waitFor(() => expect(screen.getByText('Code verified successfully!')).toBeTruthy())

      rerender(
        <PageActivityProvider active={false}>
          <RecoverPage />
        </PageActivityProvider>
      )
      act(() => vi.advanceTimersByTime(1000))
      expect(setRoute).not.toHaveBeenCalledWith(routes.CONNECTED_SUCCESS)

      rerender(
        <PageActivityProvider active>
          <RecoverPage />
        </PageActivityProvider>
      )

      await waitFor(() =>
        expect((screen.getByRole('button', { name: 'Submit OTP' }) as HTMLButtonElement).disabled).toBe(false)
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
