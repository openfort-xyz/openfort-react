import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmbeddedWallet } from '../../actions/createEmbeddedWallet.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import { MissingParameterError } from '../../errors/validation.js'
import { WalletCreationError, WalletNotConnectedError } from '../../errors/wallet.js'
import {
  asOpenfort,
  TEST_ENCRYPTION_SESSION,
  type TestClient,
  testAccount,
  testClient,
  testWalletConfig,
} from '../mocks/actionFixtures.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('createEmbeddedWallet', () => {
  let client: TestClient
  let assertCurrent: ReturnType<typeof vi.fn>
  let shouldPublish: ReturnType<typeof vi.fn>
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
      assertCurrent,
      shouldPublish,
      setActiveEmbeddedAddress,
      updateEmbeddedAccounts,
      ...overrides,
    }
  }

  beforeEach(() => {
    client = testClient(account)
    assertCurrent = vi.fn()
    shouldPublish = vi.fn(() => true)
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

  it('checks the reserving session before publishing the created account', async () => {
    assertCurrent.mockImplementation(() => {
      throw new WalletCreationError({ chain: 'Ethereum' })
    })

    await expect(createEmbeddedWallet(params())).rejects.toBeInstanceOf(WalletCreationError)

    expect(assertCurrent).toHaveBeenCalledOnce()
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })

  it('returns a created account without publishing when a newer wallet mutation owns publication', async () => {
    shouldPublish.mockReturnValue(false)

    await expect(createEmbeddedWallet(params())).resolves.toBe(account)

    expect(assertCurrent).toHaveBeenCalledTimes(2)
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
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

  it.each([
    ChainTypeEnum.EVM,
    ChainTypeEnum.SVM,
  ])('does not create on %s when the signer session changes during recovery preparation', async (chainType) => {
    const encryptionSession = deferred<string>()
    const getEncryptionSession = vi.fn(() => encryptionSession.promise)
    let current = true
    assertCurrent.mockImplementation(() => {
      if (!current) throw new WalletNotConnectedError('The wallet session changed.')
    })

    const pending = createEmbeddedWallet(
      params({
        chainType,
        accountRequest: { accountType: AccountTypeEnum.EOA },
        walletConfig: testWalletConfig({ getEncryptionSession }),
      })
    )
    await vi.waitFor(() => expect(getEncryptionSession).toHaveBeenCalledOnce())

    current = false
    encryptionSession.resolve(TEST_ENCRYPTION_SESSION)

    await expect(pending).rejects.toBeInstanceOf(WalletNotConnectedError)
    expect(client.embeddedWallet.create).not.toHaveBeenCalled()
  })

  it('does not activate anything when the create call rejects', async () => {
    client.embeddedWallet.create.mockRejectedValue(new Error('boom'))

    await expect(createEmbeddedWallet(params())).rejects.toBeInstanceOf(WalletCreationError)
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })
})
