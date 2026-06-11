import type { EmbeddedAccount } from '@openfort/openfort-js'
import { AccountTypeEnum, ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import type { Hex } from 'viem'
import type { Mock } from 'vitest'
import { vi } from 'vitest'

export const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Hex
export const MOCK_SOLANA_ADDRESS = '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs'
const MOCK_USER_ID = 'usr_test_123'
const MOCK_ACCESS_TOKEN = 'test-access-token'
export const MOCK_ENCRYPTION_SESSION = 'test-encryption-session'
const MOCK_CHAIN_ID = 80002

export function createMockEmbeddedAccount(overrides: Partial<EmbeddedAccount> = {}): EmbeddedAccount {
  return {
    id: 'emb_test_123',
    address: MOCK_ADDRESS,
    chainId: MOCK_CHAIN_ID,
    chainType: ChainTypeEnum.EVM,
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    accountType: AccountTypeEnum.SMART_ACCOUNT,
    ownerAddress: MOCK_ADDRESS,
    createdAt: Date.now(),
    ...overrides,
  } as EmbeddedAccount
}

export function createMockSolanaEmbeddedAccount(overrides: Partial<EmbeddedAccount> = {}): EmbeddedAccount {
  return {
    id: 'emb_sol_test_123',
    address: MOCK_SOLANA_ADDRESS,
    chainType: ChainTypeEnum.SVM,
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    accountType: AccountTypeEnum.EOA,
    createdAt: Date.now(),
    ...overrides,
  } as EmbeddedAccount
}

type MockClient = {
  embeddedWallet: {
    create: Mock
    list: Mock
    recover: Mock
    get: Mock
    getEmbeddedState: Mock
    getEthereumProvider: Mock
    signMessage: Mock
    setRecoveryMethod: Mock
    exportPrivateKey: Mock
  }
  user: {
    get: Mock
  }
  getAccessToken: Mock
  auth: {
    logout: Mock
  }
}

export function createMockClient(): MockClient {
  return {
    embeddedWallet: {
      create: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      list: vi.fn().mockResolvedValue([createMockEmbeddedAccount()]),
      recover: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      get: vi.fn().mockResolvedValue(createMockEmbeddedAccount()),
      getEmbeddedState: vi.fn().mockResolvedValue(EmbeddedState.READY),
      getEthereumProvider: vi.fn().mockResolvedValue({ request: vi.fn().mockResolvedValue([]) }),
      signMessage: vi.fn().mockResolvedValue('mock-signature'),
      setRecoveryMethod: vi.fn().mockResolvedValue(undefined),
      exportPrivateKey: vi.fn().mockResolvedValue('0xprivatekey'),
    },
    user: {
      get: vi.fn().mockResolvedValue({
        id: MOCK_USER_ID,
        email: 'test@example.com',
        phoneNumber: undefined,
        linkedAccounts: [],
      }),
    },
    getAccessToken: vi.fn().mockResolvedValue(MOCK_ACCESS_TOKEN),
    auth: {
      logout: vi.fn().mockResolvedValue(undefined),
    },
  }
}

export function createMockWalletConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    createEncryptedSessionEndpoint: 'https://example.com/session',
    accountType: AccountTypeEnum.SMART_ACCOUNT,
    connectOnLogin: true,
    ethereum: {
      accountType: AccountTypeEnum.SMART_ACCOUNT,
    },
    ...overrides,
  }
}
