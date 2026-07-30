import { RecoveryMethod } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { resolveSetActiveRecovery } from '../../actions/resolveSetActiveRecovery.js'
import type { BuildRecoveryParamsConfig } from '../../shared/utils/recovery.js'
import { TEST_ENCRYPTION_SESSION, testWalletConfig } from '../mocks/actionFixtures.js'

const config: BuildRecoveryParamsConfig = {
  walletConfig: testWalletConfig(),
  getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
  getUserId: vi.fn().mockResolvedValue('usr_test_123'),
}

describe('resolveSetActiveRecovery', () => {
  it('returns explicit recoveryParams verbatim, overriding the account method', async () => {
    const recoveryParams = { recoveryMethod: RecoveryMethod.PASSKEY } as never

    await expect(
      resolveSetActiveRecovery({ recoveryMethod: RecoveryMethod.PASSWORD }, { recoveryParams }, config)
    ).resolves.toEqual({ needsRecovery: false, recoveryParams })
  })

  it('treats an account with no recovery method as AUTOMATIC', async () => {
    await expect(resolveSetActiveRecovery({}, {}, config)).resolves.toEqual({
      needsRecovery: false,
      recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession: TEST_ENCRYPTION_SESSION },
    })
  })

  it('flags a PASSWORD account with no input as needing recovery', async () => {
    await expect(resolveSetActiveRecovery({ recoveryMethod: RecoveryMethod.PASSWORD }, {}, config)).resolves.toEqual({
      needsRecovery: true,
    })
  })

  it('prefers the caller passkey id over the one stored on the account', async () => {
    await expect(
      resolveSetActiveRecovery(
        { recoveryMethod: RecoveryMethod.PASSKEY, recoveryMethodDetails: { passkeyId: 'pk_stored' } },
        { passkeyId: 'pk_caller' },
        config
      )
    ).resolves.toEqual({
      needsRecovery: false,
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSKEY, passkeyInfo: { passkeyId: 'pk_caller' } },
    })
  })

  it('omits passkeyInfo when neither the caller nor the account carries a passkey id', async () => {
    await expect(resolveSetActiveRecovery({ recoveryMethod: RecoveryMethod.PASSKEY }, {}, config)).resolves.toEqual({
      needsRecovery: false,
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSKEY },
    })
  })

  it('infers PASSWORD from a bare password, whatever the account method is', async () => {
    await expect(
      resolveSetActiveRecovery({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { password: 'hunter2' }, config)
    ).resolves.toEqual({
      needsRecovery: false,
      recoveryParams: { recoveryMethod: RecoveryMethod.PASSWORD, password: 'hunter2' },
    })
  })

  it('forwards the OTP code when minting an automatic session', async () => {
    const getEncryptionSession = vi.fn().mockResolvedValue(TEST_ENCRYPTION_SESSION)

    await resolveSetActiveRecovery(
      {},
      { otpCode: '123456' },
      {
        ...config,
        walletConfig: testWalletConfig({ getEncryptionSession }),
      }
    )

    expect(getEncryptionSession).toHaveBeenCalledWith(expect.objectContaining({ otpCode: '123456' }))
  })
})
