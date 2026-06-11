import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockClient,
  createMockEmbeddedAccount,
  createMockWalletConfig,
  MOCK_ENCRYPTION_SESSION,
} from './mocks/openfort-client'
import { createTestWrapper } from './mocks/wrapper'

// --- Module-level mocks ---

const mockClient = createMockClient()
const mockWalletConfig = createMockWalletConfig()
const mockUpdateEmbeddedAccounts = vi.fn().mockResolvedValue({ data: [] })
let mockActiveEmbeddedAddress: string | null = null
const mockSetActiveEmbeddedAddress = vi.fn((addr: string) => {
  mockActiveEmbeddedAddress = addr
})
const mockSetWalletStatus = vi.fn()

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({
    client: mockClient,
    embeddedAccounts: [],
    embeddedState: undefined,
    isLoadingAccounts: false,
    updateEmbeddedAccounts: mockUpdateEmbeddedAccounts,
    setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
    setWalletStatus: mockSetWalletStatus,
    activeEmbeddedAddress: mockActiveEmbeddedAddress,
  }),
}))

vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    walletConfig: mockWalletConfig,
    chainType: ChainTypeEnum.EVM,
  }),
  useOpenfortUIContext: () => ({
    walletConfig: mockWalletConfig,
    chainType: ChainTypeEnum.EVM,
  }),
}))

vi.mock('../core/ConnectionStrategyContext', () => ({
  useConnectionStrategy: () => null,
}))

vi.mock('../utils/format', () => ({
  formatAddress: (addr: string) => addr,
}))

// --- Import hook under test (after mocks) ---

const { useEthereumEmbeddedWallet } = await import('../ethereum/hooks/useEthereumEmbeddedWallet')

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

// --- Tests ---

describe('useEthereumEmbeddedWallet – create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths: account type × recovery method ----------

  describe('EOA', () => {
    it('creates with AUTOMATIC recovery – no chainId in create call', async () => {
      const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.EOA })
      mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

      const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

  it('throws when walletConfig is missing', async () => {
    // Override walletConfig to null for this test
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortUIContext').mockReturnValue({
      walletConfig: null,
      chainType: ChainTypeEnum.EVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortUIContext>)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.create()
      })
    ).rejects.toThrow('Wallet config not found')

    spy.mockRestore()
  })

  it('throws when PASSWORD recovery is used without a password', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.create({ recoveryMethod: RecoveryMethod.PASSWORD })
      })
    ).rejects.toThrow('Password is required')
  })

  it('throws when no encryption session config is available', async () => {
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortUIContext').mockReturnValue({
      walletConfig: { connectOnLogin: true },
      chainType: ChainTypeEnum.EVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortUIContext>)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.create()
      })
    ).rejects.toThrow('No encryption session method configured')

    spy.mockRestore()
  })

  it('calls updateEmbeddedAccounts after successful create', async () => {
    const account = createMockEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await act(async () => {
      await result.current.create()
    })

    expect(mockUpdateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('defaults accountType from walletConfig.ethereum when not specified', async () => {
    const account = createMockEmbeddedAccount({ accountType: AccountTypeEnum.SMART_ACCOUNT })
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

  it('transitions status: creating → error on failure', async () => {
    mockClient.embeddedWallet.create.mockRejectedValueOnce(new Error('Create failed'))

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    let caughtError: unknown
    await act(async () => {
      try {
        await result.current.create()
      } catch (e) {
        caughtError = e
      }
    })

    expect(caughtError).toBeDefined()
    expect(result.current.status).toBe('error')
  })
})
