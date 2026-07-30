import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importEmbeddedWallet } from '../../actions/importEmbeddedWallet.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import {
  asOpenfort,
  TEST_ENCRYPTION_SESSION,
  TEST_SVM_ADDRESS,
  type TestClient,
  testAccount,
  testClient,
  testWalletConfig,
} from '../mocks/actionFixtures.js'

describe('importEmbeddedWallet', () => {
  let client: TestClient
  let setActiveEmbeddedAddress: ReturnType<typeof vi.fn>
  let updateEmbeddedAccounts: ReturnType<typeof vi.fn>

  const account = testAccount({ address: TEST_SVM_ADDRESS, chainType: ChainTypeEnum.SVM })

  function params(overrides: Record<string, unknown> = {}) {
    return {
      client: asOpenfort(client),
      walletConfig: testWalletConfig(),
      chainType: ChainTypeEnum.SVM,
      accountRequest: { accountType: AccountTypeEnum.EOA },
      recovery: undefined,
      privateKey: 'base58-secret-key',
      setActiveEmbeddedAddress,
      updateEmbeddedAccounts,
      ...overrides,
    }
  }

  beforeEach(() => {
    client = testClient(account)
    setActiveEmbeddedAddress = vi.fn()
    updateEmbeddedAccounts = vi.fn().mockResolvedValue([account])
  })

  it('forwards the private key alongside the chain-resolved request', async () => {
    const result = await importEmbeddedWallet(params())

    expect(client.embeddedWallet.import).toHaveBeenCalledWith({
      privateKey: 'base58-secret-key',
      chainType: ChainTypeEnum.SVM,
      accountType: AccountTypeEnum.EOA,
      recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: TEST_ENCRYPTION_SESSION },
    })
    expect(result).toBe(account)
  })

  it('publishes the active address before refetching the accounts list', async () => {
    const order: string[] = []
    setActiveEmbeddedAddress.mockImplementation(() => order.push('setActiveEmbeddedAddress'))
    updateEmbeddedAccounts.mockImplementation(async () => {
      order.push('updateEmbeddedAccounts')
      return [account]
    })

    await importEmbeddedWallet(params())

    expect(order).toEqual(['setActiveEmbeddedAddress', 'updateEmbeddedAccounts'])
    expect(setActiveEmbeddedAddress).toHaveBeenCalledWith(TEST_SVM_ADDRESS)
  })

  it('throws WalletConfigNotFoundError before calling the client', async () => {
    await expect(importEmbeddedWallet(params({ walletConfig: undefined }))).rejects.toBeInstanceOf(
      WalletConfigNotFoundError
    )
    expect(client.embeddedWallet.import).not.toHaveBeenCalled()
  })

  it('does not activate anything when the import call rejects', async () => {
    client.embeddedWallet.import.mockRejectedValue(new Error('bad key'))

    await expect(importEmbeddedWallet(params())).rejects.toThrow('bad key')
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })
})
