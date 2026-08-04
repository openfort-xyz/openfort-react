import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useSyncExternalStore } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageActivityProvider } from '../../components/Common/Modal/pageActivity.js'
import { LinkWalletOnSignUpOption, routes } from '../../components/Openfort/types.js'
import { WalletCreationError } from '../../errors/wallet.js'
import { invalidatePersistentOperations } from '../../shared/utils/persistentOperationRegistry.js'

/**
 * The automatic-recovery page creates an embedded wallet on arrival and, when the
 * recovery share is gated behind a one-time code, falls back to an OTP screen.
 * Both chain families run the same flow with chain-specific create calls,
 * success routes and OTP failure copy, so both are exercised here.
 */

type CoreState = {
  client: object
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
    client: {},
    captureAuthSession: vi.fn(() => ({ isCurrent: () => true })),
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
    defaultRecoveryMethod: undefined as unknown as RecoveryMethod,
    allowedRecoveryMethods: [] as RecoveryMethod[],
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
        defaultMethod: h.defaultRecoveryMethod,
        allowedMethods: h.allowedRecoveryMethods,
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
vi.mock('../../openfort/authTransitionContext', () => ({
  useAuthTransitions: () => ({ captureAuthSession: h.captureAuthSession }),
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

function creationFailure(chain: 'Ethereum' | 'Solana', message: string) {
  return { error: new WalletCreationError({ chain, cause: new Error(message) }) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

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
  invalidatePersistentOperations(h.client)
  h.setCore({
    client: h.client,
    user: { id: 'usr_1' },
    chainType: ChainTypeEnum.EVM,
    embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
    isLoadingAccounts: false,
  })
  h.connectOnLogin = true
  h.otpEnabled = true
  h.defaultRecoveryMethod = RecoveryMethod.AUTOMATIC
  h.allowedRecoveryMethods = [RecoveryMethod.AUTOMATIC]
  h.setRoute.mockReset()
  h.createEthereum.mockReset()
  h.createEthereum.mockResolvedValue({ account: { id: 'embedded_evm_test' } })
  h.createSolana.mockReset()
  h.createSolana.mockResolvedValue({ account: { id: 'embedded_svm_test' } })
  h.requestOTP.mockReset()
  h.requestOTP.mockResolvedValue({ sentTo: 'email', email: EMAIL })
})

describe('Ethereum automatic recovery', () => {
  it('falls back to an allowed method when the configured default is disallowed', () => {
    h.defaultRecoveryMethod = RecoveryMethod.AUTOMATIC
    h.allowedRecoveryMethods = [RecoveryMethod.PASSWORD]

    render(<CreateWallet />)

    expect(screen.getByText('Secure your wallet')).toBeTruthy()
    expect(h.createEthereum).not.toHaveBeenCalled()
  })

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
    h.createEthereum.mockResolvedValue(creationFailure('Ethereum', 'shield unreachable'))
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
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'shield unreachable'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/Failed to create Ethereum wallet\./)).toBeTruthy()
    expect(h.setRoute).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Retry'))

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('asks for a code when the recovery share is OTP-gated', async () => {
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    render(<CreateWallet />)

    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)
    expect(screen.getByText(EMAIL)).toBeTruthy()
  })

  it('creates the wallet with the submitted code and routes to the success page', async () => {
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
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
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'wrong code'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    await waitFor(() => expect(screen.getByText(/Failed to create Ethereum wallet\./)).toBeTruthy())
    // The failure copy clears itself after a second, which unlocks the boxes again.
    await waitFor(() => expect(screen.queryByText(/Failed to create Ethereum wallet\./)).toBeNull(), {
      timeout: 3000,
    })

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createEthereum).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.CONNECTED_SUCCESS))
  })

  it('reports a failure to send the code', async () => {
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText('Failed to send recovery code')).toBeTruthy()
  })

  it('reports the OTP requirement as a recovery error when no OTP sender is configured', async () => {
    h.otpEnabled = false
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/OTP code is required to recover the wallet\./)).toBeTruthy()
    expect(h.requestOTP).not.toHaveBeenCalled()
  })

  it('sends the user to link a contact method when the account has no real one', async () => {
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    h.requestOTP.mockResolvedValueOnce({ sentTo: 'email', email: 'abc@openfort.anonymous' })
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Cannot create wallet.')).toBeTruthy())
    fireEvent.click(screen.getByText('Add an authentication method'))

    expect(h.setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })

  it('blocks an immediate duplicate after the initial code request', async () => {
    h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
    render(<CreateWallet />)
    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)

    const resend = screen.getByText('Code Sent!') as HTMLButtonElement
    expect(resend.disabled).toBe(true)

    fireEvent.click(resend)

    expect(h.requestOTP).toHaveBeenCalledTimes(1)
  })

  it('re-enables the resend button once the cooldown elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
      render(<CreateWallet />)
      await otpScreen()

      expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      const resend = screen.getByText('Resend Code') as HTMLButtonElement
      expect(resend.disabled).toBe(false)

      fireEvent.click(resend)

      await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(2))
      expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a code that could not be resent and reopens the input', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      h.createEthereum.mockResolvedValueOnce(creationFailure('Ethereum', 'OTP_REQUIRED'))
      render(<CreateWallet />)
      await otpScreen()
      act(() => vi.advanceTimersByTime(10_000))

      h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
      fireEvent.click(screen.getByText('Resend Code'))

      await waitFor(() => expect(screen.getByText('Failed to send recovery code')).toBeTruthy())
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.queryByText('Failed to send recovery code')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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

  it('does not route when passkey creation finishes after unmount', async () => {
    const creation = deferred<{ account: { id: string } }>()
    h.defaultRecoveryMethod = RecoveryMethod.PASSKEY
    h.allowedRecoveryMethods = [RecoveryMethod.PASSKEY]
    h.createSolana.mockReturnValueOnce(creation.promise)

    const { unmount } = render(<CreateWallet />)
    await waitFor(() => expect(h.createSolana).toHaveBeenCalledOnce())
    unmount()

    await act(async () => creation.resolve({ account: { id: 'created' } }))

    expect(h.setRoute).not.toHaveBeenCalledWith(routes.SOL_CONNECTED)
  })

  it('creates even when the embedded state is ready, because an EVM wallet does not count', async () => {
    h.setCore({ embeddedState: EmbeddedState.READY })
    render(<CreateWallet />)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(1))
  })

  it('surfaces a recovery failure and retries from the loader', async () => {
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'shield unreachable'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Error creating wallet.')).toBeTruthy())
    expect(screen.getByText(/Failed to create Solana wallet\./)).toBeTruthy()
    expect(h.setRoute).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Retry'))

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('asks for a code when the recovery share is OTP-gated', async () => {
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
    render(<CreateWallet />)

    await otpScreen()
    expect(h.requestOTP).toHaveBeenCalledTimes(1)
    expect(screen.getByText(EMAIL)).toBeTruthy()
  })

  it('creates the wallet with the submitted code and routes to the connected page', async () => {
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
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
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'wrong code'))
    render(<CreateWallet />)
    await otpScreen()

    enterOtp(OTP_CODE)

    const failure = /Failed to create Solana wallet\./
    await waitFor(() => expect(screen.getByText(failure)).toBeTruthy())
    await waitFor(() => expect(screen.queryByText(failure)).toBeNull(), { timeout: 3000 })

    enterOtp(OTP_CODE)

    await waitFor(() => expect(h.createSolana).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.SOL_CONNECTED))
  })

  it('reports a failure to send the code', async () => {
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
    h.requestOTP.mockRejectedValueOnce(new Error('mailer down'))
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Failed to send recovery code')).toBeTruthy())
  })

  it('sends the user to link a contact method when the account has no real one', async () => {
    h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
    h.requestOTP.mockResolvedValueOnce({ sentTo: 'email', email: 'abc@openfort.anonymous' })
    render(<CreateWallet />)

    await waitFor(() => expect(screen.getByText('Cannot create wallet.')).toBeTruthy())
    fireEvent.click(screen.getByText('Add an authentication method'))

    expect(h.setRoute).toHaveBeenCalledWith(routes.PROVIDERS)
  })

  it('enables a new code request after the initial cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      h.createSolana.mockResolvedValueOnce(creationFailure('Solana', 'OTP_REQUIRED'))
      render(<CreateWallet />)
      await otpScreen()
      expect(h.requestOTP).toHaveBeenCalledTimes(1)
      expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)

      act(() => vi.advanceTimersByTime(10_000))
      fireEvent.click(screen.getByText('Resend Code'))

      await waitFor(() => expect(h.requestOTP).toHaveBeenCalledTimes(2))
      expect((screen.getByText('Code Sent!') as HTMLButtonElement).disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe.each([
  {
    chain: 'Ethereum',
    chainType: ChainTypeEnum.EVM,
    create: h.createEthereum,
    successRoute: routes.CONNECTED_SUCCESS,
  },
  {
    chain: 'Solana',
    chainType: ChainTypeEnum.SVM,
    create: h.createSolana,
    successRoute: routes.SOL_CONNECTED,
  },
])('$chain passkey recovery activity', ({ chainType, create, successRoute }) => {
  it('reobserves one creation when its preserved page becomes active again', async () => {
    const creation = deferred<{ account: { id: string } }>()
    h.defaultRecoveryMethod = RecoveryMethod.PASSKEY
    h.allowedRecoveryMethods = [RecoveryMethod.PASSKEY]
    h.setCore({ chainType })
    create.mockReturnValueOnce(creation.promise)

    const { rerender } = render(
      <PageActivityProvider active>
        <CreateWallet />
      </PageActivityProvider>
    )
    await waitFor(() => expect(create).toHaveBeenCalledOnce())

    rerender(
      <PageActivityProvider active={false}>
        <CreateWallet />
      </PageActivityProvider>
    )
    await act(async () => creation.resolve({ account: { id: 'created' } }))
    expect(h.setRoute).not.toHaveBeenCalledWith(successRoute)

    rerender(
      <PageActivityProvider active>
        <CreateWallet />
      </PageActivityProvider>
    )
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(successRoute))
    expect(create).toHaveBeenCalledOnce()
  })
})

describe.each([
  {
    chain: 'Ethereum' as const,
    chainType: ChainTypeEnum.EVM,
    create: h.createEthereum,
    failure: creationFailure('Ethereum', 'shield unreachable'),
  },
  {
    chain: 'Solana' as const,
    chainType: ChainTypeEnum.SVM,
    create: h.createSolana,
    failure: creationFailure('Solana', 'shield unreachable'),
  },
])('$chain password recovery', ({ chainType, create, failure }) => {
  beforeEach(() => {
    h.defaultRecoveryMethod = RecoveryMethod.PASSWORD
    h.allowedRecoveryMethods = [RecoveryMethod.PASSWORD]
    h.setCore({ chainType })
  })

  async function submitPassword() {
    const rendered = render(<CreateWallet />)
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'correct horse battery staple 2026!' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create wallet' }))
    })
    return rendered
  }

  it('clears loading when create resolves with an error', async () => {
    create.mockResolvedValueOnce(failure)

    await submitPassword()

    await waitFor(() => expect(screen.getByText(/Failed to create .* wallet\./)).toBeTruthy())
    expect((screen.getByRole('button', { name: /Create wallet/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(create).toHaveBeenCalledOnce()
    expect(h.setRoute).not.toHaveBeenCalled()
  })

  it('clears loading when create throws', async () => {
    create.mockRejectedValueOnce(new Error('network unavailable'))

    await submitPassword()

    await waitFor(() => expect(screen.getByText(/(recovering your account|Failed to create wallet)/)).toBeTruthy())
    expect((screen.getByRole('button', { name: /Create wallet/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(create).toHaveBeenCalledOnce()
    expect(h.setRoute).not.toHaveBeenCalled()
  })

  it('does not route when creation finishes after unmount', async () => {
    const creation = deferred<{ account: { id: string } }>()
    create.mockReturnValueOnce(creation.promise)

    const { unmount } = await submitPassword()
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    unmount()

    await act(async () => creation.resolve({ account: { id: 'created' } }))

    expect(h.setRoute).not.toHaveBeenCalled()
  })
})

describe.each([
  {
    chain: 'Ethereum',
    chainType: ChainTypeEnum.EVM,
    create: h.createEthereum,
    successRoute: routes.CONNECTED_SUCCESS,
  },
  {
    chain: 'Solana',
    chainType: ChainTypeEnum.SVM,
    create: h.createSolana,
    successRoute: routes.SOL_CONNECTED,
  },
])('$chain passkey recovery', ({ chainType, create, successRoute }) => {
  it('shares one non-idempotent creation across StrictMode effect replay', async () => {
    const creation = deferred<{ account: { id: string } }>()
    h.defaultRecoveryMethod = RecoveryMethod.PASSKEY
    h.allowedRecoveryMethods = [RecoveryMethod.PASSKEY]
    h.setCore({ chainType })
    create.mockReturnValueOnce(creation.promise)

    render(
      <StrictMode>
        <CreateWallet />
      </StrictMode>
    )

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    await act(async () => creation.resolve({ account: { id: 'created' } }))

    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(successRoute))
    expect(create).toHaveBeenCalledOnce()
  })
})
