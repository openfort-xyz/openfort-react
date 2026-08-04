import { AccountTypeEnum, ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importEmbeddedWallet } from '../../actions/importEmbeddedWallet.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import { WalletImportError, WalletNotConnectedError } from '../../errors/wallet.js'
import {
  asOpenfort,
  TEST_ENCRYPTION_SESSION,
  TEST_SVM_ADDRESS,
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

describe('importEmbeddedWallet', () => {
  let client: TestClient
  let assertCurrent: ReturnType<typeof vi.fn>
  let shouldPublish: ReturnType<typeof vi.fn>
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

  it('checks the reserving session before publishing the imported account', async () => {
    assertCurrent.mockImplementation(() => {
      throw new WalletImportError({ chain: 'Solana' })
    })

    await expect(importEmbeddedWallet(params())).rejects.toBeInstanceOf(WalletImportError)

    expect(assertCurrent).toHaveBeenCalledOnce()
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })

  it('returns an imported account without publishing when a newer wallet mutation owns publication', async () => {
    shouldPublish.mockReturnValue(false)

    await expect(importEmbeddedWallet(params())).resolves.toBe(account)

    expect(assertCurrent).toHaveBeenCalledTimes(2)
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })

  it('throws WalletConfigNotFoundError before calling the client', async () => {
    await expect(importEmbeddedWallet(params({ walletConfig: undefined }))).rejects.toBeInstanceOf(
      WalletConfigNotFoundError
    )
    expect(client.embeddedWallet.import).not.toHaveBeenCalled()
  })

  it.each([
    ChainTypeEnum.EVM,
    ChainTypeEnum.SVM,
  ])('does not import on %s when the signer session changes during recovery preparation', async (chainType) => {
    const encryptionSession = deferred<string>()
    const getEncryptionSession = vi.fn(() => encryptionSession.promise)
    let current = true
    assertCurrent.mockImplementation(() => {
      if (!current) throw new WalletNotConnectedError('The wallet session changed.')
    })

    const pending = importEmbeddedWallet(
      params({
        chainType,
        walletConfig: testWalletConfig({ getEncryptionSession }),
      })
    )
    await vi.waitFor(() => expect(getEncryptionSession).toHaveBeenCalledOnce())

    current = false
    encryptionSession.resolve(TEST_ENCRYPTION_SESSION)

    await expect(pending).rejects.toBeInstanceOf(WalletNotConnectedError)
    expect(client.embeddedWallet.import).not.toHaveBeenCalled()
  })

  it('does not activate anything when the import call rejects', async () => {
    client.embeddedWallet.import.mockRejectedValue(new Error('bad key'))

    await expect(importEmbeddedWallet(params())).rejects.toBeInstanceOf(WalletImportError)
    expect(setActiveEmbeddedAddress).not.toHaveBeenCalled()
    expect(updateEmbeddedAccounts).not.toHaveBeenCalled()
  })
})
