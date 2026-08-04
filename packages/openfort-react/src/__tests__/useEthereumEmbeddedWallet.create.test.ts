import { AccountTypeEnum, ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateEmbeddedSignerOperations } from '../shared/utils/embeddedSignerOperationQueue.js'
import { logger } from '../utils/logger.js'
import {
  createMockClient,
  createMockEmbeddedAccount,
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

describe('useEthereumEmbeddedWallet – create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    mockEmbeddedState = EmbeddedState.READY
    stubFetchEncryptionSession()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------- Happy paths: account type × recovery method ----------

  describe('EOA', () => {
    it('creates with AUTOMATIC recovery – no chainId in create call', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.EOA })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({ accountType: AccountTypeEnum.EOA })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainType: ChainTypeEnum.EVM,
          accountType: AccountTypeEnum.EOA,
        })
      )
      // EOA should NOT include chainId
      expect(mockClient.embeddedWallet.create.mock.calls[0][0]).not.toHaveProperty('chainId')
    })

    it('creates with PASSWORD recovery', async () => {
      const account = createMockEmbeddedAccount({
        accountType: AccountTypeEnum.EOA,
        recoveryMethod: RecoveryMethod.PASSWORD,
      })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.EOA,
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
      const account = createMockEmbeddedAccount({
        accountType: AccountTypeEnum.EOA,
        recoveryMethod: RecoveryMethod.PASSKEY,
      })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.EOA,
          recoveryMethod: RecoveryMethod.PASSKEY,
        })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recoveryParams: expect.objectContaining({
            recoveryMethod: RecoveryMethod.PASSKEY,
          }),
        })
      )
    })
  })

  describe('SMART_ACCOUNT', () => {
    it('creates with AUTOMATIC recovery – includes chainId 84532', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.SMART_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({ accountType: AccountTypeEnum.SMART_ACCOUNT })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainType: ChainTypeEnum.EVM,
          accountType: AccountTypeEnum.SMART_ACCOUNT,
          chainId: 84532,
        })
      )
    })

    it('creates with PASSWORD recovery', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.SMART_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.SMART_ACCOUNT,
          recoveryMethod: RecoveryMethod.PASSWORD,
          password: 'test-password',
        })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          recoveryParams: expect.objectContaining({
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: 'test-password',
          }),
        })
      )
    })

    it('creates with PASSKEY recovery', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.SMART_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.SMART_ACCOUNT,
          recoveryMethod: RecoveryMethod.PASSKEY,
        })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          recoveryParams: expect.objectContaining({
            recoveryMethod: RecoveryMethod.PASSKEY,
          }),
        })
      )
    })
  })

  describe('DELEGATED_ACCOUNT', () => {
    it('creates with AUTOMATIC recovery – includes chainId', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.DELEGATED_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({ accountType: AccountTypeEnum.DELEGATED_ACCOUNT })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainType: ChainTypeEnum.EVM,
          accountType: AccountTypeEnum.DELEGATED_ACCOUNT,
          chainId: 84532,
        })
      )
    })

    it('creates with PASSWORD recovery', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.DELEGATED_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.DELEGATED_ACCOUNT,
          recoveryMethod: RecoveryMethod.PASSWORD,
          password: 'test-password',
        })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          recoveryParams: expect.objectContaining({
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: 'test-password',
          }),
        })
      )
    })

    it('creates with PASSKEY recovery', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.DELEGATED_ACCOUNT })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

      await act(async () => {
        await result.current.create({
          accountType: AccountTypeEnum.DELEGATED_ACCOUNT,
          recoveryMethod: RecoveryMethod.PASSKEY,
        })
      })

      expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          recoveryParams: expect.objectContaining({
            recoveryMethod: RecoveryMethod.PASSKEY,
          }),
        })
      )
    })
  })

  // ---------- Edge cases ----------

  it('reports an error without rejecting when walletConfig is missing', async () => {
    // Override walletConfig to null for this test
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort.js')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortConfig').mockReturnValue({
      walletConfig: null,
      chainType: ChainTypeEnum.EVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortConfig>)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    const onError = vi.fn()
    await act(async () => {
      await expect(result.current.create({ onError })).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: 'Wallet config not found.' }))

    spy.mockRestore()
  })

  it('reports an error without rejecting when PASSWORD has no password', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(result.current.create({ recoveryMethod: RecoveryMethod.PASSWORD, onError })).resolves.toEqual({
        error: expect.anything(),
      })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: '`password` is required.' }))
  })

  it('reports an error without rejecting when encryption session config is unavailable', async () => {
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort.js')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortConfig').mockReturnValue({
      walletConfig: { connectOnLogin: true },
      chainType: ChainTypeEnum.EVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortConfig>)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    const onError = vi.fn()
    await act(async () => {
      await expect(result.current.create({ onError })).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ shortMessage: 'No encryption session method configured.' })
    )

    spy.mockRestore()
  })

  it('calls updateEmbeddedAccounts after successful create', async () => {
    const account = createMockEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('forwards the configured RPC endpoints when building the provider', async () => {
    // create() is the first caller of getEthereumProvider — EthereumEmbeddedStrategy
    // .initProvider is gated on EmbeddedState.READY, which a wallet being created
    // hasn't reached — and the SDK memoizes the provider on its first caller. Calling
    // it with no options pinned the session to the SDK's public default endpoints,
    // whose chain fallback is Base mainnet regardless of the app's configured chain.
    const rpcUrls = { 84532: 'https://base-sepolia.example' }
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort.js')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortConfig').mockReturnValue({
      walletConfig: createMockWalletConfig({
        ethereum: { accountType: AccountTypeEnum.SMART_ACCOUNT, rpcUrls },
      }),
      chainType: ChainTypeEnum.EVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortConfig>)

    mockClient.embeddedWallet.create.mockResolvedValueOnce(createMockEmbeddedAccount())

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await result.current.create()
    })

    expect(mockClient.embeddedWallet.getEthereumProvider).toHaveBeenCalledWith({
      chains: rpcUrls,
      announceProvider: false,
    })

    spy.mockRestore()
  })

  it('does not authorize a provider obtained after the wallet session changes', async () => {
    const account = createMockEmbeddedAccount()
    const providerRequest = vi.fn().mockResolvedValue([account.address])
    const provider = deferred<{ request: typeof providerRequest }>()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)
    mockClient.embeddedWallet.getEthereumProvider.mockReturnValueOnce(provider.promise)
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let createPromise!: Promise<unknown>
    act(() => {
      createPromise = result.current.create()
    })
    await vi.waitFor(() => expect(mockClient.embeddedWallet.getEthereumProvider).toHaveBeenCalledOnce())

    invalidateEmbeddedSignerOperations(mockClient as never)
    provider.resolve({ request: providerRequest })

    await act(async () => {
      await expect(createPromise).resolves.toMatchObject({ error: { name: 'WalletNotConnectedError' } })
    })
    expect(providerRequest).not.toHaveBeenCalled()
  })

  it('defaults accountType from walletConfig.ethereum when not specified', async () => {
    const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.SMART_ACCOUNT })
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    // No accountType in createOptions — should use walletConfig.ethereum.accountType
    await act(async () => {
      await result.current.create()
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: AccountTypeEnum.SMART_ACCOUNT,
      })
    )
  })

  it('transitions status: creating → connected on success', async () => {
    const account = createMockEmbeddedAccount()
    mockClient.embeddedWallet.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(account), 10)
        })
    )

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    let createPromise: Promise<unknown>
    act(() => {
      createPromise = result.current.create()
    })

    // During creation, status should be 'creating'
    expect(result.current.status).toBe('creating')

    await act(async () => {
      await createPromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('lets only a newer import publish after an overlapping create succeeds', async () => {
    const createdAccount = createMockEmbeddedAccount({
      id: 'emb_created_first',
      address: '0x1111111111111111111111111111111111111111',
    })
    const importedAccount = createMockEmbeddedAccount({
      id: 'emb_imported_latest',
      address: '0x2222222222222222222222222222222222222222',
    })
    const createRequest = deferred<typeof createdAccount>()
    const importRequest = deferred<typeof importedAccount>()
    mockClient.embeddedWallet.create.mockReturnValueOnce(createRequest.promise)
    const importWallet = vi.fn().mockReturnValueOnce(importRequest.promise)
    Object.assign(mockClient.embeddedWallet, { import: importWallet })
    const createOnSuccess = vi.fn()
    const importOnSuccess = vi.fn()
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    let createPromise!: ReturnType<typeof result.current.create>
    let importPromise!: ReturnType<typeof result.current.import>

    act(() => {
      createPromise = result.current.create({ onSuccess: createOnSuccess })
    })
    await vi.waitFor(() => expect(mockClient.embeddedWallet.create).toHaveBeenCalledOnce())

    act(() => {
      importPromise = result.current.import({ privateKey: '0xdeadbeef', onSuccess: importOnSuccess })
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

  it('withholds the provider while the signer reconnects', async () => {
    mockClient.embeddedWallet.create.mockResolvedValueOnce(createMockEmbeddedAccount())
    const { result, rerender } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

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

  it('transitions status: creating → error on failure', async () => {
    mockClient.embeddedWallet.create.mockRejectedValueOnce(new Error('Create failed'))

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(result.current.create({ onError })).resolves.toEqual({ error: expect.anything() })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: 'Failed to create Ethereum wallet.' }))
  })

  it('reports import failures through state and onError without rejecting', async () => {
    Object.assign(mockClient.embeddedWallet, {
      import: vi.fn().mockRejectedValueOnce(new Error('Invalid private key')),
    })

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(result.current.import({ privateKey: '0xinvalid', onError })).resolves.toEqual({
        error: expect.anything(),
      })
    })

    expect(result.current.status).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ shortMessage: 'Failed to import Ethereum wallet.' }))
  })

  it('reports recovery-method failures without rejecting', async () => {
    mockClient.embeddedWallet.setRecoveryMethod.mockRejectedValueOnce(new Error('Wrong password'))
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(
        result.current.setRecovery({
          previousRecovery: { recoveryMethod: RecoveryMethod.PASSWORD, password: 'wrong' },
          newRecovery: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'replacement' },
          onError,
        })
      ).resolves.toEqual({ error: expect.anything() })
    })

    // Changing a recovery method does not own the connection: a rejected
    // password must not leave the wallet reading as disconnected.
    expect(result.current.status).not.toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.anything())
  })

  it('reports private-key export failures without rejecting', async () => {
    mockClient.embeddedWallet.exportPrivateKey.mockRejectedValueOnce(new Error('User declined'))
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })
    const onError = vi.fn()

    await act(async () => {
      await expect(result.current.exportPrivateKey({ onError })).resolves.toEqual({ error: expect.anything() })
    })

    // A declined export leaves the wallet exactly as connected as it was.
    expect(result.current.status).not.toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.anything())
  })

  it('keeps a successful action successful when onSuccess throws', async () => {
    const account = createMockEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(
        result.current.create({
          onSuccess: () => {
            throw new Error('consumer callback failed')
          },
        })
      ).resolves.toEqual({ account })
    })

    expect(result.current.status).toBe('connected')
    expect(logger.error).toHaveBeenCalledWith('[embedded-wallet] callback threw', expect.any(Error))
  })

  it('keeps an action error settled when onError returns a rejected promise', async () => {
    mockClient.embeddedWallet.create.mockRejectedValueOnce(new Error('Create failed'))
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createQueryWrapper() })

    await act(async () => {
      await expect(
        result.current.create({
          onError: async () => {
            throw new Error('consumer callback failed')
          },
        })
      ).resolves.toEqual({ error: expect.anything() })
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(logger.error).toHaveBeenCalledWith('[embedded-wallet] callback rejected', expect.any(Error))
  })
})
