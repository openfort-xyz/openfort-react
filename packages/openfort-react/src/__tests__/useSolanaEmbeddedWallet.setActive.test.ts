import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockClient,
  createMockSolanaEmbeddedAccount,
  createMockWalletConfig,
  MOCK_ENCRYPTION_SESSION,
  MOCK_SOLANA_ADDRESS,
} from './mocks/openfort-client'
import { createTestWrapper } from './mocks/wrapper'

// --- Module-level mocks ---

const mockClient = createMockClient()
const mockWalletConfig = createMockWalletConfig()
let mockActiveEmbeddedAddress: string | null = null
const mockSetActiveEmbeddedAddress = vi.fn((addr: string) => {
  mockActiveEmbeddedAddress = addr
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

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({
    client: mockClient,
    embeddedAccounts: mockEmbeddedAccounts,
    embeddedState: undefined,
    isLoadingAccounts: false,
    updateEmbeddedAccounts: vi.fn().mockResolvedValue({ data: [] }),
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

const mockCreateSolanaProvider = vi.fn(() => ({
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
}))

vi.mock('../solana/provider', () => ({
  createSolanaProvider: (...args: unknown[]) => mockCreateSolanaProvider(...args),
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

describe('useSolanaEmbeddedWallet – setActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths ----------

  it('recovers with AUTOMATIC by address', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

  it('recovers with PASSKEY by address (reads passkeyId from recoveryMethodDetails)', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address })
    })

    expect(result.current.status).toBe('needs-recovery')
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('throws for unknown address', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.setActive({ address: 'UnknownAddressXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
      })
    ).rejects.toThrow('Embedded wallet not found')
  })

  it('transitions status: connecting → connected', async () => {
    mockClient.embeddedWallet.recover.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(automaticAccount), 10)
        })
    )

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    let setActivePromise: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })

    expect(result.current.status).toBe('connecting')

    await act(async () => {
      await setActivePromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('calls createSolanaProvider on success', async () => {
    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
    })

    expect(mockCreateSolanaProvider).toHaveBeenCalled()
    expect(result.current.status).toBe('connected')
  })

  it('recover rejection → status error and throws', async () => {
    mockClient.embeddedWallet.recover.mockRejectedValueOnce(new Error('Recover failed'))

    const { result } = renderHook(() => useSolanaEmbeddedWallet(), { wrapper: createTestWrapper() })

    let caughtError: unknown
    await act(async () => {
      try {
        await result.current.setActive({ address: MOCK_SOLANA_ADDRESS })
      } catch (e) {
        caughtError = e
      }
    })

    expect(caughtError).toBeDefined()
    expect(result.current.status).toBe('error')
  })
})
