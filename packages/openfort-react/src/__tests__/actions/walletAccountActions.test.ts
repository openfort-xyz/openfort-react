import { RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateEmbeddedAccount } from '../../actions/activateEmbeddedAccount.js'
import { exportPrivateKey } from '../../actions/exportPrivateKey.js'
import { findEmbeddedAccount } from '../../actions/findEmbeddedAccount.js'
import { setRecoveryMethod } from '../../actions/setRecoveryMethod.js'
import { RecoveryError, WalletNotFoundError } from '../../errors/wallet.js'
import {
  asOpenfort,
  TEST_EVM_ADDRESS,
  TEST_SVM_ADDRESS,
  type TestClient,
  testAccount,
  testClient,
} from '../mocks/actionFixtures.js'

const lowercase = (address: string) => address.toLowerCase()
const verbatim = (address: string) => address

describe('findEmbeddedAccount', () => {
  const evm = testAccount()
  const svm = testAccount({ id: 'emb_svm', address: TEST_SVM_ADDRESS })

  it('matches EVM addresses regardless of casing', () => {
    const found = findEmbeddedAccount({
      accounts: [evm],
      address: TEST_EVM_ADDRESS.toLowerCase(),
      normalizeAddress: lowercase,
    })

    expect(found).toBe(evm)
  })

  it('matches Solana addresses verbatim', () => {
    const found = findEmbeddedAccount({ accounts: [svm], address: TEST_SVM_ADDRESS, normalizeAddress: verbatim })

    expect(found).toBe(svm)
  })

  it('rejects a case-folded Solana address', () => {
    expect(() =>
      findEmbeddedAccount({ accounts: [svm], address: TEST_SVM_ADDRESS.toLowerCase(), normalizeAddress: verbatim })
    ).toThrow(WalletNotFoundError)
  })

  it('returns the first account when several share an address', () => {
    const duplicate = testAccount({ id: 'emb_duplicate' })

    expect(
      findEmbeddedAccount({ accounts: [evm, duplicate], address: TEST_EVM_ADDRESS, normalizeAddress: lowercase })
    ).toBe(evm)
  })

  it('throws WalletNotFoundError naming the address', () => {
    expect(() => findEmbeddedAccount({ accounts: [], address: TEST_EVM_ADDRESS, normalizeAddress: lowercase })).toThrow(
      `Embedded wallet ${TEST_EVM_ADDRESS} not found.`
    )
  })
})

describe('activateEmbeddedAccount', () => {
  it('sets the active address before silently refetching the accounts list', async () => {
    const order: string[] = []
    const account = testAccount()
    const setActiveEmbeddedAddress = vi.fn(() => {
      order.push('setActiveEmbeddedAddress')
    })
    const updateEmbeddedAccounts = vi.fn(async () => {
      order.push('updateEmbeddedAccounts')
      return [account]
    })

    await activateEmbeddedAccount({ account, setActiveEmbeddedAddress, updateEmbeddedAccounts })

    expect(order).toEqual(['setActiveEmbeddedAddress', 'updateEmbeddedAccounts'])
    expect(setActiveEmbeddedAddress).toHaveBeenCalledWith(TEST_EVM_ADDRESS)
    expect(updateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('rejects when the accounts refetch fails, after the address was published', async () => {
    const setActiveEmbeddedAddress = vi.fn()

    await expect(
      activateEmbeddedAccount({
        account: testAccount(),
        setActiveEmbeddedAddress,
        updateEmbeddedAccounts: vi.fn().mockRejectedValue(new Error('network down')),
      })
    ).rejects.toThrow('network down')
    expect(setActiveEmbeddedAddress).toHaveBeenCalledWith(TEST_EVM_ADDRESS)
  })
})

describe('setRecoveryMethod', () => {
  let client: TestClient
  const previousRecovery = { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'old' } as never
  const newRecovery = { recoveryMethod: RecoveryMethod.PASSWORD, password: 'hunter2' } as never

  beforeEach(() => {
    client = testClient()
  })

  it('switches the method and refreshes the accounts list', async () => {
    const updateEmbeddedAccounts = vi.fn().mockResolvedValue([])

    await setRecoveryMethod({ client: asOpenfort(client), previousRecovery, newRecovery, updateEmbeddedAccounts })

    expect(client.embeddedWallet.setRecoveryMethod).toHaveBeenCalledWith(previousRecovery, newRecovery)
    expect(updateEmbeddedAccounts).toHaveBeenCalledWith({ silent: true })
  })

  it('wraps a rejected switch in RecoveryError', async () => {
    client.embeddedWallet.setRecoveryMethod.mockRejectedValue(new Error('wrong password'))

    await expect(
      setRecoveryMethod({
        client: asOpenfort(client),
        previousRecovery,
        newRecovery,
        updateEmbeddedAccounts: vi.fn(),
      })
    ).rejects.toBeInstanceOf(RecoveryError)
  })

  it('wraps a rejected accounts refetch in RecoveryError', async () => {
    await expect(
      setRecoveryMethod({
        client: asOpenfort(client),
        previousRecovery,
        newRecovery,
        updateEmbeddedAccounts: vi.fn().mockRejectedValue(new Error('network down')),
      })
    ).rejects.toBeInstanceOf(RecoveryError)
  })
})

describe('exportPrivateKey', () => {
  it('returns the key the client exports', async () => {
    const client = testClient()

    await expect(exportPrivateKey({ client: asOpenfort(client) })).resolves.toBe('0xprivatekey')
    expect(client.embeddedWallet.exportPrivateKey).toHaveBeenCalledTimes(1)
  })

  it('propagates a rejected export', async () => {
    const client = testClient()
    client.embeddedWallet.exportPrivateKey.mockRejectedValue(new Error('user declined'))

    await expect(exportPrivateKey({ client: asOpenfort(client) })).rejects.toThrow('user declined')
  })
})
