import { RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { setActiveWallet } from '../../actions/setActiveWallet.js'
import { MissingParameterError } from '../../errors/validation.js'
import {
  asOpenfort,
  TEST_ENCRYPTION_SESSION,
  type TestClient,
  testAccount,
  testClient,
  testWalletConfig,
} from '../mocks/actionFixtures.js'

describe('setActiveWallet', () => {
  let client: TestClient

  beforeEach(() => {
    client = testClient()
  })

  function run(account = testAccount(), options: Record<string, unknown> = {}) {
    return setActiveWallet({
      client: asOpenfort(client),
      walletConfig: testWalletConfig(),
      account,
      options,
    })
  }

  it('recovers an AUTOMATIC account with a freshly minted encryption session', async () => {
    const result = await run()

    expect(result).toEqual({ needsRecovery: false })
    expect(client.embeddedWallet.recover).toHaveBeenCalledWith({
      account: 'emb_test_123',
      recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: TEST_ENCRYPTION_SESSION },
    })
  })

  it('reports needsRecovery for a PASSWORD account with no password', async () => {
    const result = await run(testAccount({ recoveryMethod: RecoveryMethod.PASSWORD }))

    expect(result).toEqual({ needsRecovery: true })
    expect(client.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('recovers a PASSWORD account once a password is supplied', async () => {
    const result = await run(testAccount({ recoveryMethod: RecoveryMethod.PASSWORD }), { password: 'hunter2' })

    expect(result).toEqual({ needsRecovery: false })
    expect(client.embeddedWallet.recover).toHaveBeenCalledWith({
      account: 'emb_test_123',
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSWORD, password: 'hunter2' },
    })
  })

  it('reuses the passkey id stored on a PASSKEY account', async () => {
    await run(
      testAccount({
        recoveryMethod: RecoveryMethod.PASSKEY,
        recoveryMethodDetails: { passkeyId: 'pk_stored' },
      } as never)
    )

    expect(client.embeddedWallet.recover).toHaveBeenCalledWith({
      account: 'emb_test_123',
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSKEY, passkeyInfo: { passkeyId: 'pk_stored' } },
    })
  })

  it('passes explicit recoveryParams straight through', async () => {
    const recoveryParams = { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: 'custom' }

    await run(testAccount({ recoveryMethod: RecoveryMethod.PASSWORD }), { recoveryParams })

    expect(client.embeddedWallet.recover).toHaveBeenCalledWith({ account: 'emb_test_123', recoveryParams })
  })

  it('propagates recovery-building failures without calling recover', async () => {
    await expect(run(testAccount(), { recoveryMethod: RecoveryMethod.PASSWORD })).rejects.toBeInstanceOf(
      MissingParameterError
    )
    expect(client.embeddedWallet.recover).not.toHaveBeenCalled()
  })

  it('propagates a rejected recover call', async () => {
    client.embeddedWallet.recover.mockRejectedValue(new Error('recover failed'))

    await expect(run()).rejects.toThrow('recover failed')
  })
})
