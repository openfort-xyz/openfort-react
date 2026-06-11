import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockClient, createMockEmbeddedAccount, createMockWalletConfig } from './mocks/openfort-client'
import { createTestWrapper } from './mocks/wrapper'

// --- Module-level mocks ---

const mockClient = createMockClient()
const mockWalletConfig = createMockWalletConfig()
const mockSignOut = vi.fn()
const mockUpdateEmbeddedAccounts = vi.fn()
const mockSetActiveEmbeddedAddress = vi.fn()
const mockUseOpenfortCore = vi.fn()

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => mockUseOpenfortCore(),
}))

vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    walletConfig: mockWalletConfig,
  }),
}))

vi.mock('../hooks/openfort/auth/useSignOut', () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
  }),
}))

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

vi.mock('../shared/utils/recovery', () => ({
  buildRecoveryParams: vi.fn().mockResolvedValue({ recoveryMethod: 'AUTOMATIC', encryptionKey: 'mock-key' }),
}))

const { useConnectToWalletPostAuth } = await import('../hooks/openfort/auth/useConnectToWalletPostAuth')

describe('useConnectToWalletPostAuth — tryUseWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOpenfortCore.mockReturnValue({
      client: mockClient,
      chainType: ChainTypeEnum.EVM,
      embeddedState: EmbeddedState.READY,
      activeEmbeddedAddress: undefined,
      updateEmbeddedAccounts: mockUpdateEmbeddedAccounts,
      setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
    })
    mockSignOut.mockResolvedValue(undefined)
    mockSetActiveEmbeddedAddress.mockReturnValue(undefined)
    mockClient.embeddedWallet.create.mockResolvedValue(createMockEmbeddedAccount())
    mockClient.embeddedWallet.recover.mockResolvedValue(undefined)
    Object.assign(mockWalletConfig, {
      createEncryptedSessionEndpoint: 'https://example.com/session',
      getEncryptionSession: undefined,
      connectOnLogin: true,
      ethereum: { chainId: 84532, accountType: undefined },
    })
  })

  it('creates a new wallet when no wallets exist', async () => {
    const account = createMockEmbeddedAccount()
    mockUpdateEmbeddedAccounts.mockResolvedValueOnce([]).mockResolvedValue([account])
    mockClient.embeddedWallet.create.mockResolvedValue(account)

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(mockClient.embeddedWallet.create).toHaveBeenCalled()
    expect(tryResult!.wallet).toBeDefined()
    expect(tryResult!.wallet!.address).toBe(account.address)
  })

  it('recovers wallet with AUTOMATIC recovery when wallet exists', async () => {
    const autoAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([autoAccount])
    mockClient.embeddedWallet.recover.mockResolvedValue(undefined)

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalledWith(expect.objectContaining({ account: autoAccount.id }))
    expect(tryResult!.wallet).toBeDefined()
  })

  it('recovers wallet with PASSKEY recovery when wallet exists', async () => {
    const passkeyAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.PASSKEY,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([passkeyAccount])
    mockClient.embeddedWallet.recover.mockResolvedValue(undefined)

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(mockClient.embeddedWallet.recover).toHaveBeenCalled()
    expect(tryResult!.wallet).toBeDefined()
  })

  it('returns passwordRequired when only PASSWORD wallets exist', async () => {
    const pwAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.PASSWORD,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([pwAccount])

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(tryResult!.passwordRequired).toBe(true)
    expect(tryResult!.wallet).toBeUndefined()
    expect(mockClient.embeddedWallet.create).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('returns empty when no encryption session config', async () => {
    mockWalletConfig.createEncryptedSessionEndpoint = undefined
    mockWalletConfig.getEncryptionSession = undefined

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(tryResult!).toEqual({})
    expect(mockClient.embeddedWallet.create).not.toHaveBeenCalled()
  })

  it('returns empty when connectOnLogin is false', async () => {
    mockWalletConfig.connectOnLogin = false

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(tryResult!).toEqual({})
    expect(mockClient.embeddedWallet.create).not.toHaveBeenCalled()
  })

  it('returns empty when recoverWalletAutomatically option is false', async () => {
    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({
        recoverWalletAutomatically: false,
      })
    })

    expect(tryResult!).toEqual({})
    expect(mockClient.embeddedWallet.create).not.toHaveBeenCalled()
  })

  it('calls signOut when createWallet fails and logoutOnError is true', async () => {
    mockUpdateEmbeddedAccounts.mockResolvedValue([])
    mockClient.embeddedWallet.create.mockRejectedValue(new Error('Creation failed'))

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.tryUseWallet({ logoutOnError: true })
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('does not call signOut when createWallet fails and logoutOnError is false', async () => {
    mockUpdateEmbeddedAccounts.mockResolvedValue([])
    mockClient.embeddedWallet.create.mockRejectedValue(new Error('Creation failed'))

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.tryUseWallet({ logoutOnError: false })
    })

    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('calls signOut when setActiveWallet fails and logoutOnError is true', async () => {
    const autoAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([autoAccount])
    mockClient.embeddedWallet.recover.mockRejectedValue(new Error('Recovery failed'))

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.tryUseWallet({ logoutOnError: true })
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('returns empty when updateEmbeddedAccounts resolves undefined', async () => {
    mockUpdateEmbeddedAccounts.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(tryResult!).toEqual({})
    expect(mockClient.embeddedWallet.create).not.toHaveBeenCalled()
    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('returns wallet without calling recover when wallet address is already active', async () => {
    const autoAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([autoAccount])
    mockUseOpenfortCore.mockReturnValue({
      client: mockClient,
      chainType: ChainTypeEnum.EVM,
      embeddedState: EmbeddedState.READY,
      activeEmbeddedAddress: autoAccount.address,
      updateEmbeddedAccounts: mockUpdateEmbeddedAccounts,
      setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
    })

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
    expect(tryResult!.wallet).toBeDefined()
    expect(tryResult!.wallet!.address).toBe(autoAccount.address)
  })

  it('sets active address without calling recover when embedded state is not READY', async () => {
    const autoAccount = createMockEmbeddedAccount({
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      chainType: ChainTypeEnum.EVM,
    })
    mockUpdateEmbeddedAccounts.mockResolvedValue([autoAccount])
    mockUseOpenfortCore.mockReturnValue({
      client: mockClient,
      chainType: ChainTypeEnum.EVM,
      embeddedState: EmbeddedState.CREATING_ACCOUNT,
      activeEmbeddedAddress: undefined,
      updateEmbeddedAccounts: mockUpdateEmbeddedAccounts,
      setActiveEmbeddedAddress: mockSetActiveEmbeddedAddress,
    })

    const { result } = renderHook(() => useConnectToWalletPostAuth(), {
      wrapper: createTestWrapper(),
    })

    let tryResult: Awaited<ReturnType<typeof result.current.tryUseWallet>>
    await act(async () => {
      tryResult = await result.current.tryUseWallet({})
    })

    expect(mockClient.embeddedWallet.recover).not.toHaveBeenCalled()
    expect(mockSetActiveEmbeddedAddress).toHaveBeenCalledWith(autoAccount.address)
    expect(tryResult!.wallet).toBeDefined()
  })
})
