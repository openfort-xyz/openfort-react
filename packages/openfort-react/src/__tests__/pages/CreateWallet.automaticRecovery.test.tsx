import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkWalletOnSignUpOption, routes } from '../../components/Openfort/types.js'

/**
 * The automatic-recovery page creates an embedded wallet on arrival and, when the
 * recovery share is gated behind a one-time code, falls back to an OTP screen.
 * Both chain families run the same flow with chain-specific create calls,
 * success routes and OTP failure copy, so both are exercised here.
 */

type CoreState = {
  user: { id: string } | null
  chainType: ChainTypeEnum
  embeddedState: EmbeddedState
  isLoadingAccounts: boolean
}

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  // The core state is an external store each page subscribes to on its own, which is
  // what lets a page re-render when the SDK moves the embedded state underneath it.
  const store = { current: {} as Record<string, unknown> }
  return {
    store,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setCore: (patch: Record<string, unknown>) => {
      store.current = { ...store.current, ...patch }
      for (const listener of listeners) listener()
    },
    connectOnLogin: true as boolean | undefined,
    otpEnabled: true,
    setRoute: vi.fn(),
    createEthereum: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    createSolana: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    requestOTP: vi.fn<() => Promise<unknown>>(),
  }
})

vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => ({
    setRoute: h.setRoute,
    triggerResize: vi.fn(),
    walletConfig: { connectOnLogin: h.connectOnLogin },
    uiConfig: {
      linkWalletOnSignUp: LinkWalletOnSignUpOption.DISABLED,
      walletRecovery: {
        defaultMethod: RecoveryMethod.AUTOMATIC,
        allowedMethods: [RecoveryMethod.AUTOMATIC],
      },
    },
    setOnBack: vi.fn(),
    setPreviousRoute: vi.fn(),
    setRouteHistory: vi.fn(),
  })
  return { useOpenfort: hook, useOpenfortConfig: hook, useOpenfortRouting: hook, useOpenfortForms: hook }
})
vi.mock('../../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (s: CoreState) => unknown) =>
    useSyncExternalStore(h.subscribe, () => selector(h.store.current as unknown as CoreState)),
}))
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({ status: 'disconnected', create: h.createEthereum }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'disconnected', create: h.createSolana }),
}))
vi.mock('../../shared/hooks/useRecoveryOTP', () => ({
  useRecoveryOTP: () => ({ isEnabled: h.otpEnabled, requestOTP: h.requestOTP }),
}))
vi.mock('../../hooks/openfort/auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn() }) }))
// FitText measures DOM sizes that jsdom cannot provide
vi.mock('../../components/Common/FitText', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// The retry tooltip reads the theme context, which only the full modal tree provides
vi.mock('../../components/Common/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { default: CreateWallet } = await import('../../components/Pages/CreateWallet/index.js')

const OTP_CODE = '123456789'
const EMAIL = 'user@example.com'

/** Fills every box of the standalone OTP input, which submits on the last digit. */
function enterOtp(code: string) {
  const boxes = screen.getAllByRole('textbox')
  code.split('').forEach((digit, index) => {
    const box = boxes[index]
    if (box) fireEvent.change(box, { target: { value: digit } })
  })
}

/** Resolves once creation has failed with the OTP sentinel and the code screen is up. */
function otpScreen() {
  return waitFor(() => expect(screen.getByText('Enter your code')).toBeTruthy())
}

beforeEach(() => {
  h.setCore({
    user: { id: 'usr_1' },
    chainType: ChainTypeEnum.EVM,
    embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
    isLoadingAccounts: false,
  })
  h.connectOnLogin = true
  h.otpEnabled = true
  h.setRoute.mockReset()
  for (const fn of [h.createEthereum, h.createSolana]) {
    fn.mockReset()
    fn.mockResolvedValue(undefined)
  }
  h.requestOTP.mockReset()
  h.requestOTP.mockResolvedValue({ sentTo: 'email', email: EMAIL })
})

describe('Ethereum automatic recovery', () => {
  it('creates the wallet on arrival and routes to the success page', async () => {
    render(<CreateWallet />)

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(1))
    expect(h.createEthereum).toHaveBeenCalledWith({ recoveryMethod: RecoveryMethod.AUTOMATIC })
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('waits for the account list to settle before creating', async () => {
    h.setCore({ isLoadingAccounts: true })
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Creating wallet...')).toBeTruthy())
    expect(h.createEthereum).not.toHaveBeenCalled()

    act(() => h.setCore({ isLoadingAccounts: false }))

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(1))
  })

  it('creates only once when the embedded state cycles back to unconfigured', async () => {
    h.createEthereum.mockRejectedValue(new Error('shield unreachable'))
    render(<CreateWallet />)
    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())

    act(() => h.setCore({ embeddedState: EmbeddedState.CREATING_ACCOUNT }))
    act(() => h.setCore({ embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED }))

    expect(h.createEthereum).toHaveBeenCalledTimes(1)
  })

  it('offers a manual trigger instead of a spinner when connectOnLogin is off', async () => {
    h.connectOnLogin = false
    render(<CreateWallet />)

    expect(h.createEthereum).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Create wallet' }))

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(1))
  })

  it('surfaces a recovery failure and retries from the loader', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('shield unreachable'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/Wallet recovery failed\./)).toBeTruthy()
    expect(h.setRoute).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Retry'))

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('asks for a code when the recovery share is OTP-gated', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)

    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)
    expect(screen.getByText(EMAIL)).toBeTruthy()
  })

  it('creates the wallet with the submitted code and routes to the success page', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(2))
    expect(h.createEthereum).toHaveBeenLastCalledWith({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      otpCode: OTP_CODE,
    })
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('reports a rejected code and reopens the input so it can be retyped', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.createEthereum.mockRejectedValueOnce(new Error('wrong code'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    await waitFor(() => expect(screen.getByText('There was an error verifying the OTP')).toBeTruthy())
    // The failure copy clears itself after a second, which unlocks the boxes again.
    await waitFor(() => expect(screen.queryByText('There was an error verifying the OTP')).toBeNull(), {
      timeout: 3000,
    })

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('reports a failure to send the code', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText('Failed to send recovery code')).toBeTruthy()
  })

  it('reports the OTP requirement as a recovery error when no OTP sender is configured', async () => {
    h.otpEnabled = false
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/OTP code is required to recover the wallet\./)).toBeTruthy()
    expect(h.requestOTP).not.toHaveBeenCalled()
  })

  it('sends the user to link a contact method when the account has no real one', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.requestOTP.mockResolvedValueOnce({ sentTo: 'email', email: 'abc@openfort.anonymous' })
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Cannot create wallet.')).toBeTruthy())
    fireEvent.click(screen.getByText('Add an authentication method'))

    expect(h.setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })

  it('asks for a new code when resend is pressed', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)

    const resend = screen.getByText('Resend Code') as HTMLButtonElement
    expect(resend.disabled).toBe(false)

    fireEvent.click(resend)

    await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(2))
    expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)
  })

  it('re-enables the resend button once the cooldown elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
      render(<CreateWallet />)
      await otpScreen()

      fireEvent.click(screen.getByText('Resend Code'))
      await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(2))
      expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      const resend = screen.getByText('Resend Code') as HTMLButtonElement
      expect(resend.disabled).toBe(false)

      fireEvent.click(resend)

      await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(3))
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a code that could not be resent and reopens the input', async () => {
    h.createEthereum.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()

    h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
    fireEvent.click(screen.getByText('Resend Code'))

    await waitFor(() => expect(screen.getByText('Failed to send recovery code')).toBeTruthy())
    await waitFor(() => expect(screen.queryByText('Failed to send recovery code')).toBeNull(), { timeout: 3000 })
  })
})

describe('Solana automatic recovery', () => {
  beforeEach(() => {
    h.setCore({ chainType: ChainTypeEnum.SVM })
  })

  it('creates the wallet on arrival and routes to the connected page', async () => {
    render(<CreateWallet />)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(1))
    expect(h.createSolana).toHaveBeenCalledWith({ recoveryMethod: RecoveryMethod.AUTOMATIC })
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('creates even when the embedded state is ready, because an EVM wallet does not count', async () => {
    h.setCore({ embeddedState: EmbeddedState.READY })
    render(<CreateWallet />)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(1))
  })

  it('surfaces a recovery failure and retries from the loader', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('shield unreachable'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/Wallet recovery failed\./)).toBeTruthy()
    expect(h.setRoute).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Retry'))

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('asks for a code when the recovery share is OTP-gated', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)

    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)
    expect(screen.getByText(EMAIL)).toBeTruthy()
  })

  it('creates the wallet with the submitted code and routes to the connected page', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(2))
    expect(h.createSolana).toHaveBeenLastCalledWith({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      otpCode: OTP_CODE,
    })
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('reports a rejected code and reopens the input so it can be retyped', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.createSolana.mockRejectedValueOnce(new Error('wrong code'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    const failure = 'There was an error verifying the OTP. Please try again.'
    await waitFor(() => expect(screen.getByText(failure)).toBeTruthy())
    await waitFor(() => expect(screen.queryByText(failure)).toBeNull(), { timeout: 3000 })

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('reports a failure to send the code', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Failed to send recovery code')).toBeTruthy())
  })

  it('sends the user to link a contact method when the account has no real one', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    h.requestOTP.mockResolvedValueOnce({ sentTo: 'email', email: 'abc@openfort.anonymous' })
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Cannot create wallet.')).toBeTruthy())
    fireEvent.click(screen.getByText('Add an authentication method'))

    expect(h.setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })

  it('asks for a new code when resend is pressed', async () => {
    h.createSolana.mockRejectedValueOnce(new Error('OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Resend Code'))

    await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(2))
    expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)
  })
})
