import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmbeddedWallet } from '../../actions/createEmbeddedWallet.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import { MissingParameterError } from '../../errors/validation.js'
import {
  asOpenfort,
  TEST_ENCRYPTION_SESSION,
  type TestClient,
  testAccount,
  testClient,
  testWalletConfig,
} from '../mocks/actionFixtures.js'

describe('createEmbeddedWallet', () => {
  let client: TestClient
  let setActiveEmbeddedAddress: ReturnType<typeof vi.fn>
  let updateEmbeddedAccounts: ReturnType<typeof vi.fn>

  const account = testAccount()

  function params(overrides: Record<string, unknown> = {}) {
    return {
      client: asOpenfort(client),
      walletConfig: testWalletConfig(),
      chainType: ChainTypeEnum.EVM,
      accountRequest: { accountType: AccountTypeEnum.SMART_ACCOUNT, chainId: 84532 },
      recovery: undefined,
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

  it('creates the account with the chain-resolved request and returns it', async () => {
    const result = await createEmbeddedWallet(params())

    expect(client.embeddedWallet.create).toHaveBeenCalledWith({
      chainType: ChainTypeEnum.EVM,
      accountType: AccountTypeEnum.SMART_ACCOUNT,
      chainId: 84532,
      recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: TEST_ENCRYPTION_SESSION },
    })
    expect(result).toBe(account)
  })

  it('omits chainId when the chain did not resolve one', async () => {
    await createEmbeddedWallet(params({ accountRequest: { accountType: AccountTypeEnum.EOA } }))

    expect(client.embeddedWallet.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ chainId: expect.anything() })
    )
  })

  it('publishes the active address before refetching the accounts list', async () => {
    const order: string[] = []
    setActiveEmbeddedAddress.mockImplementation(() => order.push('setActiveEmbeddedAddress'))
    updateEmbeddedAccounts.mockImplementation(async () => {
      order.push('updateEmbeddedAccounts')
      return [account]
    })

    await createEmbeddedWallet(params())

    expect(order).toEqual(['setActiveEmbeddedAddress', 'updateEmbeddedAccounts'])
    expect(setActiveEmbeddedAddress).toHaveBeenCalledWith(account.address)
    expect(updateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('resolves the account from the create call, not the refetched list', async () => {
    const stale = testAccount({ id: 'emb_stale', address: '0x0000000000000000000000000000000000000001' })
    updateEmbeddedAccounts.mockResolvedValue([stale])

    await expect(createEmbeddedWallet(params())).resolves.toBe(account)
  })

  it('throws WalletConfigNotFoundError before calling the client', async () => {
    await expect(createEmbeddedWallet(params({ walletConfig: undefined }))).rejects.toBeInstanceOf(
      WalletConfigNotFoundError
    )
    expect(client.embeddedWallet.create).not.toHaveBeenCalled()
  })

  it('builds PASSWORD recovery params from the supplied password', async () => {
    await createEmbeddedWallet(params({ recovery: { recoveryMethod: RecoveryMethod.PASSWORD, password: 'hunter2' } }))

    expect(client.embeddedWallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryParams: { recoveryMethod: RecoveryMethod.PASSWORD, password: 'hunter2' },
      })
    )
  })

  it('propagates recovery-building failures without creating anything', async () => {
    await expect(
      createEmbeddedWallet(params({ recovery: { recoveryMethod: RecoveryMethod.PASSWORD } }))
    ).rejects.toBeInstanceOf(MissingParameterError)
    expect(client.embeddedWallet.create).not.toHaveBeenCalled()
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
  })

  it('does not activate anything when the create call rejects', async () => {
    client.embeddedWallet.create.mockRejectedValue(new Error('boom'))

    await expect(createEmbeddedWallet(params())).rejects.toThrow('boom')
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })
})
