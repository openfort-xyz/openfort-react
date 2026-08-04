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
  MOCK_ADDRESS,
  MOCK_ENCRYPTION_SESSION,
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

const automaticAccount = createMockEmbeddedAccount({
  recoveryMethod: RecoveryMethod.AUTOMATIC,
  chainType: ChainTypeEnum.EVM,
})
const passwordAccount = createMockEmbeddedAccount({
  id: 'emb_pwd_123',
  address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  recoveryMethod: RecoveryMethod.PASSWORD,
  chainType: ChainTypeEnum.EVM,
})
const passkeyAccount = createMockEmbeddedAccount({
  id: 'emb_passkey_123',
  address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  recoveryMethod: RecoveryMethod.PASSKEY,
  chainType: ChainTypeEnum.EVM,
  recoveryMethodDetails: { passkeyId: 'pk_test_abc123' },
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
    chainType: ChainTypeEnum.EVM,
  })
  return { useOpenfort: hook, useOpenfortUIContext: hook, useOpenfortConfig: hook, useOpenfortRouting: hook }
})

vi.mock('../core/ConnectionStrategyContext', () => ({
  useConnectionStrategy: () => null,
}))

vi.mock('../utils/format', () => ({
  formatAddress: (addr: string) => addr,
}))

// --- Import hook under test (after mocks) ---

const { useEthereumEmbeddedWallet } = await import('../ethereum/hooks/useEthereumEmbeddedWallet.js')

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

describe('useEthereumEmbeddedWallet – setActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    mockEmbeddedState = EmbeddedState.READY
    mockClient.embeddedWallet.get.mockResolvedValue(automaticAccount)
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths ----------

  it('recovers with AUTOMATIC by address', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_ADDRESS })
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
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

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
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address, password: 'my-password' })
    })

    expect(mockSetEmbeddedState).toHaveBeenCalledWith(EmbeddedState.READY)
    expect(result.current.status).toBe('connected')
  })

  it('recovers with PASSKEY by address (reads passkeyId from recoveryMethodDetails)', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passkeyAccount.address })
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: passkeyAccount.id,
        recoveryParams: expect.objectContaining({
          recoveryMethod: RecoveryMethod.PASSKEY,
          passkeyInfo: { passkeyId: 'pk_test_abc123' },
        }),
      })
    )
    expect(result.current.status).toBe('connected')
  })

  // ---------- Edge cases ----------

  it('PASSWORD wallet without password → needs-recovery status', async () => {
    // Pre-set active address so the cleanup effect doesn't reset needs-recovery to disconnected
    mockActiveEmbeddedAddress = passwordAccount.address

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address })
    })

    expect(result.current.status).toBe('needs-recovery')
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('resolves with error state for an unknown address', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(
        result.current.setActive({ address: '0x0000000000000000000000000000000000000000' })
      ).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/^Embedded wallet 0x\w+ not found\./)
  })

  it('transitions status: connecting → connected', async () => {
    mockClient.embeddedWallet.recover.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(automaticAccount), 10)
        })
    )

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let setActivePromise: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: MOCK_ADDRESS })
    })

    await act(async () => Promise.resolve())
    expect(result.current.status).toBe('connecting')

    await act(async () => {
      await setActivePromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('serializes concurrent setActive calls', async () => {
    let activeRecoveries = 0
    let maxConcurrentRecoveries = 0
    mockClient.embeddedWallet.recover.mockImplementation(async () => {
      activeRecoveries += 1
      maxConcurrentRecoveries = Math.max(maxConcurrentRecoveries, activeRecoveries)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeRecoveries -= 1
      return automaticAccount
    })

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await Promise.all([
        result.current.setActive({ address: MOCK_ADDRESS }),
        result.current.setActive({ address: MOCK_ADDRESS }),
        result.current.setActive({ address: MOCK_ADDRESS }),
      ])
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledTimes(3)
    expect(maxConcurrentRecoveries).toBe(1)
    expect(result.current.status).toBe('connected')
  })

  it('lets only the latest overlapping setActive call publish state and callbacks', async () => {
    const firstRecovery = deferred<typeof automaticAccount>()
    const secondRecovery = deferred<typeof passwordAccount>()
    mockClient.embeddedWallet.recover
      .mockImplementationOnce(() => firstRecovery.promise)
      .mockImplementationOnce(() => secondRecovery.promise)
    const firstOnSuccess = vi.fn()
    const secondOnSuccess = vi.fn()
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    let firstRequest!: ReturnType<typeof result.current.setActive>
    let secondRequest!: ReturnType<typeof result.current.setActive>

    act(() => {
      firstRequest = result.current.setActive({ address: automaticAccount.address, onSuccess: firstOnSuccess })
    })
    await waitFor(() => expect(mockClient.embeddedWallet.recover).toHaveBeenCalledOnce())

    act(() => {
      secondRequest = result.current.setActive({
        address: passwordAccount.address,
        password: 'my-password',
        onSuccess: secondOnSuccess,
      })
    })

    let firstResult!: Awaited<typeof firstRequest>
    await act(async () => {
      firstRecovery.resolve(automaticAccount)
      firstResult = await firstRequest
    })
    await waitFor(() => expect(mockClient.embeddedWallet.recover).toHaveBeenCalledTimes(2))

    expect(firstResult).toEqual({ needsRecovery: false })
    expect(firstOnSuccess).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({
      status: 'connecting',
      activeWallet: { address: passwordAccount.address },
      isConnecting: true,
      isConnected: false,
    })
    expect(mockSetActiveEmbeddedAddress).not.toHaveBeenCalledWith(automaticAccount.address)

    let secondResult!: Awaited<typeof secondRequest>
    await act(async () => {
      secondRecovery.resolve(passwordAccount)
      secondResult = await secondRequest
    })

    expect(secondResult).toEqual({ needsRecovery: false })
    expect(secondOnSuccess).toHaveBeenCalledOnce()
    expect(result.current).toMatchObject({
      status: 'connected',
      activeWallet: { address: passwordAccount.address },
      isConnecting: false,
      isConnected: true,
    })
    expect(mockSetActiveEmbeddedAddress).toHaveBeenCalledWith(passwordAccount.address)
  })

  it('lets a newer setActive in another hook instance own publication over an older create', async () => {
    const createdAccount = createMockEmbeddedAccount({
      id: 'emb_created_in_first_hook',
      address: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    const createRequest = deferred<typeof createdAccount>()
    const recoveryRequest = deferred<typeof automaticAccount>()
    mockClient.embeddedWallet.create.mockReturnValueOnce(createRequest.promise)
    mockClient.embeddedWallet.recover.mockReturnValueOnce(recoveryRequest.promise)
    const createOnSuccess = vi.fn()
    const setActiveOnSuccess = vi.fn()
    const { result } = renderHook(() => ({ first: useEthereumEmbeddedWallet(), second: useEthereumEmbeddedWallet() }), {
      wrapper: createQueryWrapper(),
    })
    let createPromise!: ReturnType<typeof result.current.first.create>
    let setActivePromise!: ReturnType<typeof result.current.second.setActive>

    act(() => {
      createPromise = result.current.first.create({ onSuccess: createOnSuccess })
    })
    await waitFor(() => expect(mockClient.embeddedWallet.create).toHaveBeenCalledOnce())

    act(() => {
      setActivePromise = result.current.second.setActive({
        address: automaticAccount.address,
        onSuccess: setActiveOnSuccess,
      })
    })

    let createResult!: Awaited<typeof createPromise>
    await act(async () => {
      createRequest.resolve(createdAccount)
      createResult = await createPromise
    })
    await waitFor(() => expect(mockClient.embeddedWallet.recover).toHaveBeenCalledOnce())

    expect(createResult).toEqual({ account: createdAccount })
    expect(createOnSuccess).not.toHaveBeenCalled()
    expect(mockSetActiveEmbeddedAddress).not.toHaveBeenCalledWith(createdAccount.address)
    expect(result.current.first).toMatchObject({ status: 'disconnected', activeWallet: null })

    await act(async () => {
      recoveryRequest.resolve(automaticAccount)
      await setActivePromise
    })

    expect(setActiveOnSuccess).toHaveBeenCalledOnce()
    expect(mockSetActiveEmbeddedAddress).toHaveBeenCalledWith(automaticAccount.address)
    expect(result.current.second).toMatchObject({
      status: 'connected',
      activeWallet: { address: automaticAccount.address },
    })
  })

  it('reports a queued setActive invalidated before recovery through its result and onError', async () => {
    const queueGate = deferred<void>()
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => queueGate.promise)
    const onError = vi.fn()
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let setActivePromise!: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: MOCK_ADDRESS, onError, onSuccess })
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()

    invalidateEmbeddedSignerOperations(mockClient as never)
    queueGate.resolve()
    await expect(blocker).rejects.toMatchObject({ name: 'WalletNotConnectedError' })

    let setActiveResult!: unknown
    await act(async () => {
      setActiveResult = await setActivePromise
    })

    expect(setActiveResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'WalletNotConnectedError' }))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('does not expose a private key that settles after the wallet session is invalidated', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    mockEmbeddedState = EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED
    const privateKey = deferred<string>()
    mockClient.embeddedWallet.exportPrivateKey.mockReturnValueOnce(privateKey.promise)
    const onError = vi.fn()
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let exportPromise!: Promise<unknown>
    act(() => {
      exportPromise = result.current.exportPrivateKey({ onError, onSuccess })
    })
    await waitFor(() => expect(mockClient.embeddedWallet.exportPrivateKey).toHaveBeenCalledOnce())

    invalidateEmbeddedSignerOperations(mockClient as never)
    privateKey.resolve('0xstale-private-key')
    let exportResult!: unknown
    await act(async () => {
      exportResult = await exportPromise
    })

    expect(exportResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'WalletNotConnectedError' }))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not change recovery after account lookup crosses an auth boundary', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const currentAccount = deferred<typeof automaticAccount>()
    mockClient.embeddedWallet.get.mockReturnValueOnce(currentAccount.promise)
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let recoveryPromise!: Promise<unknown>
    act(() => {
      recoveryPromise = result.current.setRecovery({
        previousRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old-session' },
        newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'new-session' },
      })
    })
    await waitFor(() => expect(mockClient.embeddedWallet.get).toHaveBeenCalledOnce())

    invalidateEmbeddedSignerOperations(mockClient as never)
    currentAccount.resolve(automaticAccount)

    let recoveryResult!: unknown
    await act(async () => {
      recoveryResult = await recoveryPromise
    })

    expect(recoveryResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.setRecoveryMethod).not.toHaveBeenCalled()
  })

  it('serializes every signer action across hook instances through provider settlement', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const createdAccount = createMockEmbeddedAccount({
      id: 'emb_created',
      address: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    const importedAccount = createMockEmbeddedAccount({
      id: 'emb_imported',
      address: '0xdddddddddddddddddddddddddddddddddddddddd',
    })
    const createOperation = deferred<typeof createdAccount>()
    const createProvider = deferred<{ request: ReturnType<typeof vi.fn> }>()
    const imported = vi.fn().mockResolvedValue(importedAccount)
    Object.assign(mockClient.embeddedWallet, { import: imported })
    mockClient.embeddedWallet.create.mockReturnValueOnce(createOperation.promise)
    mockClient.embeddedWallet.getEthereumProvider
      .mockReturnValueOnce(createProvider.promise)
      .mockResolvedValue({ request: vi.fn().mockResolvedValue([]) })

    const { result } = renderHook(() => ({ first: useEthereumEmbeddedWallet(), second: useEthereumEmbeddedWallet() }), {
      wrapper: createQueryWrapper(),
    })

    let createPromise: Promise<unknown>
    let importPromise: Promise<unknown>
    let recoveryPromise: Promise<unknown>
    let exportPromise: Promise<unknown>
    let setActivePromise: Promise<unknown>
    act(() => {
      createPromise = result.current.first.create()
      importPromise = result.current.second.import({ privateKey: '0xdeadbeef' })
      recoveryPromise = result.current.second.setRecovery({
        previousRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old-session' },
        newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'new-session' },
      })
      exportPromise = result.current.second.exportPrivateKey()
      setActivePromise = result.current.second.setActive({ address: automaticAccount.address })
    })

    await Promise.resolve()
    expect(imported).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.setRecoveryMethod).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.exportPrivateKey).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()

    createOperation.resolve(createdAccount)
    await waitFor(() => expect(mockClient.embeddedWallet.getEthereumProvider).toHaveBeenCalledOnce())
    expect(imported).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()

    createProvider.resolve({ request: vi.fn().mockResolvedValue([]) })
    await act(async () => {
      await Promise.all([createPromise!, importPromise!, recoveryPromise!, exportPromise!, setActivePromise!])
    })

    expect(imported).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.setRecoveryMethod).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.exportPrivateKey).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.create.mock.invocationCallOrder[0]).toBeLessThan(
      imported.mock.invocationCallOrder[0]
    )
    expect(imported.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.embeddedWallet.setRecoveryMethod.mock.invocationCallOrder[0]
    )
    expect(mockClient.embeddedWallet.setRecoveryMethod.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.embeddedWallet.exportPrivateKey.mock.invocationCallOrder[0]
    )
    expect(mockClient.embeddedWallet.exportPrivateKey.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.embeddedWallet.recover.mock.invocationCallOrder[0]
    )
  })

  it('does not set recovery after a queued same-chain active-wallet change', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const queueGate = deferred<void>()
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => queueGate.promise)

    let recoveryPromise!: Promise<unknown>
    act(() => {
      recoveryPromise = result.current.setRecovery({
        previousRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old-session' },
        newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'new-session' },
      })
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.get).not.toHaveBeenCalled()
    mockActiveEmbeddedAddress = passwordAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(passwordAccount)
    let recoveryResult!: unknown
    await act(async () => {
      queueGate.resolve()
      await blocker
      recoveryResult = await recoveryPromise
    })

    expect(recoveryResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.setRecoveryMethod).not.toHaveBeenCalled()
  })

  it('does not export a key after a queued cross-chain active-wallet change', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const queueGate = deferred<void>()
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => queueGate.promise)
    const solanaAccount = createMockSolanaEmbeddedAccount()

    let exportPromise!: Promise<unknown>
    act(() => {
      exportPromise = result.current.exportPrivateKey()
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.get).not.toHaveBeenCalled()
    mockActiveEmbeddedAddress = solanaAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(solanaAccount)
    let exportResult!: unknown
    await act(async () => {
      queueGate.resolve()
      await blocker
      exportResult = await exportPromise
    })

    expect(exportResult).toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    expect(mockClient.embeddedWallet.exportPrivateKey).not.toHaveBeenCalled()
  })

  it('blocks implicit EVM operations while the active embedded account is SVM', async () => {
    const solanaAccount = createMockSolanaEmbeddedAccount()
    mockActiveEmbeddedAddress = solanaAccount.address
    mockClient.embeddedWallet.get.mockResolvedValue(solanaAccount)
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

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

  it('serializes address synchronization with explicit recovery', async () => {
    mockActiveEmbeddedAddress = automaticAccount.address
    const syncProvider = {
      request: vi.fn(({ method }: { method: string }) =>
        Promise.resolve(method === 'eth_accounts' ? [automaticAccount.address] : [])
      ),
    }
    let resolveSyncProvider: ((provider: typeof syncProvider) => void) | undefined
    mockClient.embeddedWallet.getEthereumProvider.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSyncProvider = resolve
        })
    )

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await waitFor(() => expect(mockClient.embeddedWallet.getEthereumProvider).toHaveBeenCalledTimes(1))

    let setActivePromise: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: passwordAccount.address, password: 'my-password' })
    })
    await Promise.resolve()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()

    resolveSyncProvider?.(syncProvider)
    await act(async () => {
      await setActivePromise!
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({ account: passwordAccount.id })
    )
    expect(result.current.status).toBe('connected')
  })

  it('provider is available after setActive', async () => {
    const mockProvider = { request: vi.fn() }
    mockClient.embeddedWallet.getEthereumProvider.mockResolvedValueOnce(mockProvider)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_ADDRESS })
    })

    expect(result.current.status).toBe('connected')
    if (result.current.status === 'connected') {
      expect(result.current.provider).toBeDefined()
    }
  })

  it.each([
    'provider',
    'activeWallet.getProvider',
  ] as const)('serializes requests made through the public %s surface', async (surface) => {
    const rawRequest = vi.fn(async ({ method }: { method: string }) =>
      method === 'eth_accounts' ? [MOCK_ADDRESS] : '0xsigned'
    )
    mockClient.embeddedWallet.getEthereumProvider.mockResolvedValue({ request: rawRequest })
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    await act(async () => {
      await result.current.setActive({ address: MOCK_ADDRESS })
    })
    if (result.current.status !== 'connected') throw new Error('Expected a connected Ethereum provider')
    const provider = surface === 'provider' ? result.current.provider : await result.current.activeWallet.getProvider()
    rawRequest.mockClear()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(mockClient as never, () => gate)

    const request = provider.request({ method: 'personal_sign', params: ['message', MOCK_ADDRESS] })
    expect(rawRequest).not.toHaveBeenCalled()
    release()
    await blocker

    await expect(request).resolves.toBe('0xsigned')
    expect(rawRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: ['message', MOCK_ADDRESS] })
  })

  it('passes explicit recoveryParams through', async () => {
    const customRecoveryParams = {
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      encryptionSession: 'custom-session',
    }

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.setActive({
        address: MOCK_ADDRESS,
        recoveryParams: customRecoveryParams,
      })
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(
      expect.objectContaining({
        account: automaticAccount.id,
        recoveryParams: customRecoveryParams,
      })
    )
  })

  it('recover rejection resolves with error state', async () => {
    mockClient.embeddedWallet.recover.mockRejectedValueOnce(new Error('Recover failed'))

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(result.current.setActive({ address: MOCK_ADDRESS })).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Failed to set active Ethereum wallet.')
  })
})
