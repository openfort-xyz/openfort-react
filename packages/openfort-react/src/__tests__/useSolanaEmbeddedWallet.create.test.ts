import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockClient,
  createMockSolanaEmbeddedAccount,
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
    chainType: ChainTypeEnum.SVM,
  }),
  useOpenfortUIContext: () => ({
    walletConfig: mockWalletConfig,
    chainType: ChainTypeEnum.SVM,
  }),
}))

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

const { useSolanaEmbeddedWallet } = await import('../solana/hooks/useSolanaEmbeddedWallet')

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

describe('useSolanaEmbeddedWallet – create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths ----------

  it('creates with AUTOMATIC recovery – chainType SVM, accountType EOA, no chainId', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

  it('throws when walletConfig is missing', async () => {
    const mockOpenfortUI = await import('../components/Openfort/useOpenfort')
    const spy = vi.spyOn(mockOpenfortUI, 'useOpenfortUIContext').mockReturnValue({
      walletConfig: null,
      chainType: ChainTypeEnum.SVM,
    } as ReturnType<typeof mockOpenfortUI.useOpenfortUIContext>)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.create()
      })
    ).rejects.toThrow('Wallet config not found')

    spy.mockRestore()
  })

  it('throws when PASSWORD recovery is used without a password', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.create({ recoveryMethod: RecoveryMethod.PASSWORD })
      })
    ).rejects.toThrow('Password is required')
  })

  it('calls updateEmbeddedAccounts after successful create', async () => {
    const account = createMockSolanaEmbeddedAccount()
    mockClient.embeddedWallet.create.mockResolvedValueOnce(account)

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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
})
