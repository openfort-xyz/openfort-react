import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockClient,
  createMockEmbeddedAccount,
  createMockWalletConfig,
  MOCK_ADDRESS,
  MOCK_ENCRYPTION_SESSION,
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

describe('useEthereumEmbeddedWallet – setActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEmbeddedAddress = null
    stubFetchEncryptionSession()
  })

  // ---------- Happy paths ----------

  it('recovers with AUTOMATIC by address', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await act(async () => {
      await result.current.setActive({ address: passwordAccount.address })
    })

    expect(result.current.status).toBe('needs-recovery')
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('throws for unknown address', async () => {
    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await expect(
      act(async () => {
        await result.current.setActive({ address: '0x0000000000000000000000000000000000000000' })
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

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    let setActivePromise: Promise<unknown>
    act(() => {
      setActivePromise = result.current.setActive({ address: MOCK_ADDRESS })
    })

    expect(result.current.status).toBe('connecting')

    await act(async () => {
      await setActivePromise!
    })

    expect(result.current.status).toBe('connected')
  })

  it('provider is available after setActive', async () => {
    const mockProvider = { request: vi.fn() }
    mockClient.embeddedWallet.getEthereumProvider.mockResolvedValueOnce(mockProvider)

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    await act(async () => {
      await result.current.setActive({ address: MOCK_ADDRESS })
    })

    expect(result.current.status).toBe('connected')
    if (result.current.status === 'connected') {
      expect(result.current.provider).toBeDefined()
    }
  })

  it('passes explicit recoveryParams through', async () => {
    const customRecoveryParams = {
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      encryptionSession: 'custom-session',
    }

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

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

  it('recover rejection → status error', async () => {
    mockClient.embeddedWallet.recover.mockRejectedValueOnce(new Error('Recover failed'))

    const { result } = renderHook(() => useEthereumEmbeddedWallet(), { wrapper: createTestWrapper() })

    let caughtError: unknown
    await act(async () => {
      try {
        await result.current.setActive({ address: MOCK_ADDRESS })
      } catch (e) {
        caughtError = e
      }
    })

    expect(caughtError).toBeDefined()
    expect(result.current.status).toBe('error')
  })
})
