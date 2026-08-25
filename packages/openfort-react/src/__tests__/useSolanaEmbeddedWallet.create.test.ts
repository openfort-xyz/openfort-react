import { AccountTypeEnum, ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockClient,
  createMockSolanaEmbeddedAccount,
  createMockWalletConfig,
  MOCK_ENCRYPTION_SESSION,
} from './mocks/openfortClient.js'
import { createQueryWrapper } from './mocks/TestWrapper.js'

// --- Module-level mocks ---

const mockClient = createMockClient()
const mockWalletConfig = createMockWalletConfig()
const mockUpdateEmbeddedAccounts = vi.fn().mockResolvedValue({ data: [] })
let mockActiveEmbeddedAddress: string | null = null
let mockEmbeddedState = EmbeddedState.READY
const mockSetActiveEmbeddedAddress = vi.fn((addr: string) => {
  mockActiveEmbeddedAddress = addr
})
const mockSetWalletStatus = vi.fn()

vi.mock('../openfort/useOpenfort', () => {
  const getState = () => ({
    client: mockClient,
    embeddedAccounts: [],
    embeddedState: mockEmbeddedState,
    isLoadingAccounts: false,
    updateEmbeddedAccounts: mockUpdateEmbeddedAccounts,
    setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
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

vi.mock('../solana/provider', () => ({
  createSolanaProvider: vi.fn(() => ({
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
  })),
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

describe('useSolanaEmbeddedWallet – create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    mockEmbeddedState = EmbeddedState.READY
    stubFetchEncryptionSession()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------- Happy paths ----------

  it('creates with AUTOMATIC recovery – chainType SVM, accountType EOA, no chainId', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create()
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        chainType: ChainTypeEnum.SVM,
        accountType: AccountTypeEnum.EOA,
      })
    )
    // Solana create should NOT include chainId
    expect(mockClient.embeddedWallet.create.mock.calls[0][0]).not.toHaveProperty('chainId')
  })

  it('creates with PASSWORD recovery', async () => {
    const account = createMockSolanaEmbeddedAccount({ recoveryMethod: RecoveryMethod.PASSWORD })
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create({
        recoveryMethod: RecoveryMethod.PASSWORD,
        password: 'test-password',
      })
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.PASSWORD,
          password: 'test-password',
        }),
      })
    )
  })

  it('creates with PASSKEY recovery', async () => {
    const account = createMockSolanaEmbeddedAccount({ recoveryMethod: RecoveryMethod.PASSKEY })
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create({ recoveryMethod: RecoveryMethod.PASSKEY })
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.PASSKEY,
        }),
      })
    )
  })

  // ---------- Edge cases ----------

  it('always uses SVM + EOA regardless of options', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    // Pass SMART_ACCOUNT — hook should ignore and use EOA
    await act(async () => {
      await result.current.create({ accountType: AccountTypeEnum.SMART_ACCOUNT })
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        chainType: ChainTypeEnum.SVM,
        accountType: AccountTypeEnum.EOA,
      })
    )
  })

  it('reports an error without rejecting when walletConfig is missing', async () => {
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort.js')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortConfig').mockReturnValue({
      walletConfig: null,
      chainType: ChainTypeEnum.SVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortConfig>)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    const onError = vi.fn()
    await act(async () => {
      await expect(result.current.create({ onError })).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: 'Wallet config not found.' }))

    spy.mockRestore()
  })

  it('reports an error without rejecting when PASSWORD has no password', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(result.current.create({ recoveryMethod: RecoveryMethod.PASSWORD, onError })).resolves.toEqual({
        error: expect.anything(),
      })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: '`password` is required.' }))
  })

  it('calls updateEmbeddedAccounts after successful create', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('transitions status: creating → connected on success', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(account), 10)
        })
    )

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let createPromise: Promise<unknown>
    act(() => {
      createPromise = result.current.create()
    })

    expect(result.current.status).toBe('creating')

    await act(async () => {
      await createPromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('lets only a newer import publish after an overlapping create succeeds', async () => {
    const createdAccount = createMockSolanaEmbeddedAccount({
      id: 'emb_sol_created_first',
      address: 'BrFKFNqStNnmDBCzPHfRJSVoFGCN1XSceAu3zp9VPuST',
    })
    const importedAccount = createMockSolanaEmbeddedAccount({
      id: 'emb_sol_imported_latest',
      address: 'DJM3THsP5DiLjGqXHVR6XNNmTpFRcLkPBFv1sjFqMzCA',
    })
    const createRequest = deferred<typeof createdAccount>()
    const importRequest = deferred<typeof importedAccount>()
    mockClient.embeddedWallet.create.mockReturnValueOnce(createRequest.promise)
    const importWallet = vi.fn().mockReturnValueOnce(importRequest.promise)
    Object.assign(mockClient.embeddedWallet, { import: importWallet })
    const createOnSuccess = vi.fn()
    const importOnSuccess = vi.fn()
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })
    let createPromise!: ReturnType<typeof result.current.create>
    let importPromise!: ReturnType<typeof result.current.import>

    act(() => {
      createPromise = result.current.create({ onSuccess: createOnSuccess })
    })
    await vi.waitFor(() => expect(mockClient.embeddedWallet.create).toHaveBeenCalledOnce())

    act(() => {
      importPromise = result.current.import({ privateKey: 'base58-secret-key', onSuccess: importOnSuccess })
    })

    let createResult!: Awaited<typeof createPromise>
    await act(async () => {
      createRequest.resolve(createdAccount)
      createResult = await createPromise
    })
    await vi.waitFor(() => expect(importWallet).toHaveBeenCalledOnce())

    expect(createResult).toEqual({ account: createdAccount })
    expect(createOnSuccess).not.toHaveBeenCalled()
    expect(mockSetActiveEmbeddedAddress).not.toHaveBeenCalledWith(createdAccount.address)
    expect(result.current).toMatchObject({ status: 'creating', isLoading: true, isConnected: false })

    let importResult!: Awaited<typeof importPromise>
    await act(async () => {
      importRequest.resolve(importedAccount)
      importResult = await importPromise
    })

    expect(importResult).toEqual({ account: importedAccount })
    expect(importOnSuccess).toHaveBeenCalledOnce()
    expect(mockSetActiveEmbeddedAddress).toHaveBeenCalledWith(importedAccount.address)
    expect(result.current).toMatchObject({
      status: 'connected',
      activeWallet: { address: importedAccount.address },
      isLoading: false,
      isConnected: true,
    })
  })

  it('lets a newer create in another hook instance own publication over an older import', async () => {
    const importedAccount = createMockSolanaEmbeddedAccount({
      id: 'emb_sol_imported_in_first_hook',
      address: 'BrFKFNqStNnmDBCzPHfRJSVoFGCN1XSceAu3zp9VPuST',
    })
    const createdAccount = createMockSolanaEmbeddedAccount({
      id: 'emb_sol_created_in_second_hook',
      address: 'DJM3THsP5DiLjGqXHVR6XNNmTpFRcLkPBFv1sjFqMzCA',
    })
    const importRequest = deferred<typeof importedAccount>()
    const createRequest = deferred<typeof createdAccount>()
    const importWallet = vi.fn().mockReturnValueOnce(importRequest.promise)
    Object.assign(mockClient.embeddedWallet, { import: importWallet })
    mockClient.embeddedWallet.create.mockReturnValueOnce(createRequest.promise)
    const importOnSuccess = vi.fn()
    const createOnSuccess = vi.fn()
    const { result } = renderHook(() => ({ first: useSolanaEmbeddedWallet(), second: useSolanaEmbeddedWallet() }), {
      wrapper: createQueryWrapper(),
    })
    let importPromise!: ReturnType<typeof result.current.first.import>
    let createPromise!: ReturnType<typeof result.current.second.create>

    act(() => {
      importPromise = result.current.first.import({ privateKey: 'base58-secret-key', onSuccess: importOnSuccess })
    })
    await vi.waitFor(() => expect(importWallet).toHaveBeenCalledOnce())

    act(() => {
      createPromise = result.current.second.create({ onSuccess: createOnSuccess })
    })

    let importResult!: Awaited<typeof importPromise>
    await act(async () => {
      importRequest.resolve(importedAccount)
      importResult = await importPromise
    })
    await vi.waitFor(() => expect(mockClient.embeddedWallet.create).toHaveBeenCalledOnce())

    expect(importResult).toEqual({ account: importedAccount })
    expect(importOnSuccess).not.toHaveBeenCalled()
    expect(mockSetActiveEmbeddedAddress).not.toHaveBeenCalledWith(importedAccount.address)
    expect(result.current.first).toMatchObject({ status: 'disconnected', activeWallet: null })

    await act(async () => {
      createRequest.resolve(createdAccount)
      await createPromise
    })

    expect(createOnSuccess).toHaveBeenCalledOnce()
    expect(mockSetActiveEmbeddedAddress).toHaveBeenCalledWith(createdAccount.address)
    expect(result.current.second).toMatchObject({
      status: 'connected',
      activeWallet: { address: createdAccount.address },
    })
  })

  it('withholds the provider while the signer reconnects', async () => {
    mockClient.embeddedWallet.create.mockResolvedValueOnce(createMockSolanaEmbeddedAccount())
    const { result, rerender } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create()
    })
    expect(result.current.status).toBe('connected')

    mockEmbeddedState = EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED
    rerender()

    expect(result.current).toMatchObject({ status: 'reconnecting', isConnected: false, isReconnecting: true })
    expect(result.current).not.toHaveProperty('provider')

    mockEmbeddedState = EmbeddedState.READY
    rerender()
    expect(result.current.status).toBe('connected')
    expect(result.current).toHaveProperty('provider')
  })
})
