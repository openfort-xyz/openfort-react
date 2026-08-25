import type { EmbeddedAccount, Openfort } from '@openfort/openfort-js'
import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { type Mock, vi } from 'vitest'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'

export const TEST_ENCRYPTION_SESSION = 'test-encryption-session'
export const TEST_EVM_ADDRESS = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
export const TEST_SVM_ADDRESS = '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs'

export type TestClient = {
  embeddedWallet: {
    create: Mock
    import: Mock
    recover: Mock
    setRecoveryMethod: Mock
    exportPrivateKey: Mock
  }
  user: { get: Mock }
  getAccessToken: Mock
}

/** Account fixture with EVM defaults; override anything the test cares about. */
export function testAccount(overrides: Partial<EmbeddedAccount> = {}): EmbeddedAccount {
  return {
    id: 'emb_test_123',
    address: TEST_EVM_ADDRESS,
    chainId: 84532,
    chainType: ChainTypeEnum.EVM,
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    accountType: AccountTypeEnum.SMART_ACCOUNT,
    createdAt: 0,
    ...overrides,
  } as EmbeddedAccount
}

/** Mocked Openfort client whose embedded-wallet calls all resolve. */
export function testClient(account: EmbeddedAccount = testAccount()): TestClient {
  return {
    embeddedWallet: {
      create: vi.fn().mockResolvedValue(account),
      import: vi.fn().mockResolvedValue(account),
      recover: vi.fn().mockResolvedValue(account),
      setRecoveryMethod: vi.fn().mockResolvedValue(undefined),
      exportPrivateKey: vi.fn().mockResolvedValue('0xprivatekey'),
    },
    user: { get: vi.fn().mockResolvedValue({ id: 'usr_test_123' }) },
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
  }
}

export function asOpenfort(client: TestClient): Openfort {
  return client as unknown as Openfort
}

/** Wallet config that mints encryption sessions without touching the network. */
export function testWalletConfig(overrides: Partial<OpenfortWalletConfig> = {}): OpenfortWalletConfig {
  return {
    getEncryptionSession: async () => TEST_ENCRYPTION_SESSION,
    ethereum: { accountType: AccountTypeEnum.SMART_ACCOUNT },
    ...overrides,
  } as OpenfortWalletConfig
}
