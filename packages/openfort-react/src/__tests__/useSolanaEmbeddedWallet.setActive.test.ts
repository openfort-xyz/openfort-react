import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../shared/utils/embeddedSignerOperationQueue.js'
import {
  createMockClient,
  createMockEmbeddedAccount,
  createMockSolanaEmbeddedAccount,
  createMockWalletConfig,
  MOCK_ENCRYPTION_SESSION,
  MOCK_SOLANA_ADDRESS,
} from './mocks/openfortClient.js'
import { createQueryWrapper } from './mocks/TestWrapper.js'

// --- Module-level mocks ---

const mockClient = createMockClient()
const mockWalletConfig = createMockWalletConfig()
let mockActiveEmbeddedAddress: string | null = null
let mockEmbeddedState = EmbeddedState.READY
const mockSetActiveEmbeddedAddress = vi.fn((addr: string) => {
  mockActiveEmbeddedAddress = addr
})
const mockSetEmbeddedState = vi.fn((state: EmbeddedState) => {
  mockEmbeddedState = state
})
const mockSetWalletStatus = vi.fn()

const automaticAccount = createMockSolanaEmbeddedAccount({
  recoveryMethod: RecoveryMethod.AUTOMATIC,
})
const passwordAccount = createMockSolanaEmbeddedAccount({
  id: 'emb_sol_pwd_123',
  address: 'BrFKFNqStNnmDBCzPHfRJSVoFGCN1XSceAu3zp9VPuST',
  recoveryMethod: RecoveryMethod.PASSWORD,
})
const passkeyAccount = createMockSolanaEmbeddedAccount({
  id: 'emb_sol_passkey_123',
  address: 'DJM3THsP5DiLjGqXHVR6XNNmTpFRcLkPBFv1sjFqMzCA',
  recoveryMethod: RecoveryMethod.PASSKEY,
  recoveryMethodDetails: { passkeyId: 'pk_sol_test_abc123' },
})

const mockEmbeddedAccounts = [automaticAccount, passwordAccount, passkeyAccount]

vi.mock('../openfort/useOpenfort', () => {
  const getState = () => ({
    client: mockClient,
    embeddedAccounts: mockEmbeddedAccounts,
    embeddedState: mockEmbeddedState,
    isLoadingAccounts: false,
    updateEmbeddedAccounts: vi.fn().mockResolvedValue({ data: [] }),
    setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
    setEmbeddedState: mockSetEmbeddedState,
    setWalletStatus: mockSetWalletStatus,
    activeEmbeddedAddress: mockActiveEmbeddedAddress,
  })
  return { useOpenfortCore: (selector: (s: ReturnType<typeof getState>) => unknown) => selector(getState()) }
})

vi.mock('../components/Openfort/useOpenfort', () => {
  const hook = () => ({
    walletConfig: mockWalletConfig,
    chainType: ChainTypeEnum.SVM,
  })
  return { useOpenfort: hook, useOpenfortUIContext: hook, useOpenfortConfig: hook, useOpenfortRouting: hook }
})

vi.mock('../utils/format', () => ({
  formatAddress: (addr: string) => addr,
}))

vi.mock('../utils/rpc', () => ({
  getDefaultSolanaRpcUrl: () => 'https://api.devnet.solana.com',
}))

const mockCreateSolanaProvider = vi.fn(
  (provider: {
    signMessage: (message: string) => Promise<string>
    signTransaction: (transaction: unknown) => Promise<unknown>
    signAllTransactions: (transactions: unknown[]) => Promise<unknown[]>
  }) => provider
)

vi.mock('../solana/provider', () => ({
  createSolanaProvider: (...args: unknown[]) => mockCreateSolanaProvider(...args),
}))

vi.mock('../solana/operations', () => ({
  getTransactionBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
}))

// --- Import hook under test (after mocks) ---

const { useSolanaEmbeddedWallet } = await import('../solana/hooks/useSolanaEmbeddedWallet.js')

// --- Helpers ---

function stubFetchEncryptionSession() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: MOCK_ENCRYPTION_SESSION }),
    })
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

// --- Tests ---

describe('useSolanaEmbeddedWallet – setActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    mockEmbeddedState = EmbeddedState.READY
    mockClient.embeddedWallet.get.mockResolvedValue(automaticAccount)
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths ----------

  it('recovers with AUTOMATIC by address', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: automaticAccount.id,
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.AUTOMATIC,
          encryptionSession: MOCK_ENCRYPTION_SESSION,
        }),
      })
    )
    expect(result.current.status).toBe('connected')
  })

  it('recovers with PASSWORD when password is provided', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({
        address: passwordAccount.address,
        password: 'my-password',
      })
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: passwordAccount.id,
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.PASSWORD,
          password: 'my-password',
        }),
      })
    )
    expect(result.current.status).toBe('connected')
  })

  it('publishes READY after explicit password recovery restores the signer', async () => {
    mockEmbeddedState = EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address, password: 'my-password' })
    })

    expect(mockSetEmbeddedState).toHaveBeenCalledWith(EmbeddedState.READY)
    expect(result.current.status).toBe('connected')
  })

  it('recovers with PASSKEY by address (reads passkeyId from recoveryMethodDetails)', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passkeyAccount.address })
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: passkeyAccount.id,
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.PASSKEY,
          passkeyInfo: { passkeyId: 'pk_sol_test_abc123' },
        }),
      })
    )
    expect(result.current.status).toBe('connected')
  })

  // ---------- Edge cases ----------

  it('PASSWORD wallet without password → needs-recovery status', async () => {
    // Pre-set active address so the cleanup effect doesn't reset needs-recovery to disconnected
    mockActiveEmbeddedAddress = passwordAccount.address

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address })
    })

    expect(result.current.status).toBe('needs-recovery')
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('resolves with error state for an unknown address', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(
        result.current.setActive({ address: 'UnknownAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
      ).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/^Embedded wallet \w+ not found\./)
  })

  it('transitions status: connecting → connected', async () => {
    mockClient.embeddedWallet.recover.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(automaticAccount), 10)
        })
    )

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let setActivePromise: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })

    await act(async () => Promise.resolve())
    expect(result.current.status).toBe('connecting')

    await act(async () => {
      await setActivePromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('calls createSolanaProvider on success', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })

    expect(mockCreateSolanaProvider).toHaveBeenCalled()
    expect(result.current.status).toBe('connected')
  })

  it.each([
    ['signMessage', 1],
    ['signTransaction', 1],
  ] as const)('serializes provider %s with other client signer operations', async (method, signatureCount) => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })
    if (result.current.status !== 'connected') throw new Error('Expected a connected Solana provider')

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => gate)
    let signatureRequest!: Promise<unknown>
    act(() => {
      if (method === 'signMessage') signatureRequest = result.current.provider.signMessage('hello')
      else if (method === 'signTransaction') signatureRequest = result.current.provider.signTransaction({} as never)
    })

    expect(mockClient.embeddedWallet.signMessage).not.toHaveBeenCalled()
    release()
    await blocker
    await signatureRequest
    expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledTimes(signatureCount)
  })

  it('signs every transaction in a batch sequentially within one queued operation', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })
    if (result.current.status !== 'connected') throw new Error('Expected a connected Solana provider')

    let resolveFirst!: (signature: string) => void
    mockClient.embeddedWallet.signMessage
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce('second-signature')

    const signatures = result.current.provider.signAllTransactions([{} as never, {} as never])
    await vi.waitFor(() => expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledOnce())
    await Promise.resolve()
    expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledOnce()

    resolveFirst('first-signature')
    await signatures
    expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledTimes(2)
  })

  it('does not sign the next batch item after the wallet session is invalidated', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })
    if (result.current.status !== 'connected') throw new Error('Expected a connected Solana provider')

    const firstSignature = deferred<string>()
    mockClient.embeddedWallet.signMessage.mockReturnValueOnce(firstSignature.promise)

    const signatures = result.current.provider.signAllTransactions([{} as never, {} as never])
    await vi.waitFor(() => expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledOnce())

    invalidateEmbeddedSignerOperations(mockClient as never)
    firstSignature.resolve('first-signature')

    await expect(signatures).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    expect(mockClient.embeddedWallet.signMessage).toHaveBeenCalledOnce()
  })

  it('does not export a key after a queued same-chain active-wallet change', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const queueGate = deferred<void>()
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => queueGate.promise)

    let exportPromise!: Promise<unknown>
    act(() => {
      exportPromise = result.current.exportPrivateKey()
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.get).not.toHaveBeenCalled()
    mockActiveEmbeddedAddress = passwordAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(passwordAccount)
    let exportResult!: unknown
    await act(async () => {
      queueGate.resolve()
      await blocker
      exportResult = await exportPromise
    })

    expect(exportResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.exportPrivateKey).not.toHaveBeenCalled()
  })

  it('does not set recovery after a queued cross-chain active-wallet change', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const queueGate = deferred<void>()
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => queueGate.promise)
    const ethereumAccount = createMockEmbeddedAccount()

    let recoveryPromise!: Promise<unknown>
    act(() => {
      recoveryPromise = result.current.setRecovery({
        previousRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old-session' },
        newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'new-session' },
      })
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.get).not.toHaveBeenCalled()
    mockActiveEmbeddedAddress = ethereumAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(ethereumAccount)
    let recoveryResult!: unknown
    await act(async () => {
      queueGate.resolve()
      await blocker
      recoveryResult = await recoveryPromise
    })

    expect(recoveryResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.setRecoveryMethod).not.toHaveBeenCalled()
  })

  it('blocks implicit SVM operations while the active embedded account is EVM', async () => {
    const ethereumAccount = createMockEmbeddedAccount()
    mockActiveEmbeddedAddress = ethereumAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(ethereumAccount)
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let exportResult!: unknown
    let recoveryResult!: unknown
    await act(async () => {
      exportResult = await result.current.exportPrivateKey()
      recoveryResult = await result.current.setRecovery({
        previousRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old-session' },
        newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'new-session' },
      })
    })

    expect(exportResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(recoveryResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.exportPrivateKey).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.setRecoveryMethod).not.toHaveBeenCalled()
  })

  it('rejects a stale provider batch after a queued active-wallet change', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })
    if (result.current.status !== 'connected') throw new Error('Expected a connected Solana provider')
    const staleProvider = result.current.provider
    mockClient.embeddedWallet.signMessage.mockClear()
    let resolveRecovery!: () => void
    mockClient.embeddedWallet.recover.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRecovery = resolve
        })
    )

    let setActivePromise!: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: passwordAccount.address, password: 'my-password' })
    })
    await waitFor(() => expect(mockClient.embeddedWallet.recover).toHaveBeenCalledOnce())
    const signing = staleProvider.signAllTransactions([{} as never, {} as never])
    mockClient.embeddedWallet.get.mockResolvedValue(passwordAccount)

    await act(async () => {
      resolveRecovery()
      await setActivePromise
    })

    await expect(signing).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    expect(mockClient.embeddedWallet.signMessage).not.toHaveBeenCalled()
  })

  it('recover rejection resolves with error state', async () => {
    mockClient.embeddedWallet.recover.mockRejectedValueOnce(new Error('Recover failed'))

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(result.current.setActive({ address: MOCK_SOLANA_ADDRESS })).resolves.toEqual({
        error: expect.anything(),
      })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Failed to set active Solana wallet.')
  })
})
