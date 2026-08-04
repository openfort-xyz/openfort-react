import { RecoveryMethod, type RecoveryParams } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import { NotAuthenticatedError } from '../../errors/auth.js'
import { OpenfortConfigError, WalletConfigNotFoundError } from '../../errors/config.js'
import { UnsupportedOperationError } from '../../errors/operation.js'
import { MissingParameterError } from '../../errors/validation.js'
import { OtpRequiredError, RecoveryError } from '../../errors/wallet.js'
import { fetchRecoveryRequest } from './recoveryRequest.js'

type RecoveryOptions = {
  recoveryMethod?: RecoveryMethod
  passkeyId?: string
  password?: string
  otpCode?: string
}

export type BuildRecoveryParamsConfig = {
  walletConfig: OpenfortWalletConfig | undefined
  getAccessToken: () => Promise<string | null>
  getUserId: () => Promise<string | undefined>
}

export async function buildRecoveryParams(
  options: RecoveryOptions | undefined,
  config: BuildRecoveryParamsConfig
): Promise<RecoveryParams> {
  const { walletConfig, getAccessToken, getUserId } = config
  const recoveryMethod = options?.recoveryMethod ?? RecoveryMethod.AUTOMATIC

  switch (recoveryMethod) {
    case RecoveryMethod.AUTOMATIC: {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        throw new NotAuthenticatedError('Access token not found.')
      }

      const userId = await getUserId()
      if (!userId) {
        throw new NotAuthenticatedError('User not found.')
      }

      const encryptionSession = await getEncryptionSession({
        accessToken,
        userId,
        otpCode: options?.otpCode,
        walletConfig,
      })

      return {
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        encryptionSession,
      }
    }

    case RecoveryMethod.PASSWORD: {
      if (!options?.password) {
        throw new MissingParameterError({ params: ['password'] })
      }
      return {
        recoveryMethod: RecoveryMethod.PASSWORD,
        password: options.password,
      }
    }

    case RecoveryMethod.PASSKEY:
      return {
        recoveryMethod: RecoveryMethod.PASSKEY,
        ...(options?.passkeyId && { passkeyInfo: { passkeyId: options.passkeyId } }),
      } as RecoveryParams

    default:
      throw new UnsupportedOperationError({ operation: `Recovery method "${recoveryMethod}"` })
  }
}

async function getEncryptionSession(params: {
  accessToken: string
  userId: string
  otpCode?: string
  walletConfig: OpenfortWalletConfig | undefined
}): Promise<string> {
  const { accessToken, userId, otpCode, walletConfig } = params

  if (!walletConfig) {
    throw new WalletConfigNotFoundError()
  }

  if (walletConfig.getEncryptionSession) {
    const session = await walletConfig.getEncryptionSession({ accessToken, userId, otpCode })
    if (typeof session !== 'string' || session.length === 0) {
      throw new RecoveryError('`getEncryptionSession` returned an invalid session.', {
        details: 'Expected a non-empty string.',
      })
    }
    return session
  }

  if (walletConfig.createEncryptedSessionEndpoint) {
    const response = await fetchRecoveryRequest(
      walletConfig.createEncryptedSessionEndpoint,
      {
        method: 'POST',
        // The endpoint mints the credential that unlocks the wallet's key share,
        // so it has to be able to tell which signed-in user is asking.
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
      },
      'Create wallet recovery encryption session'
    )

    type SessionResponse = { error?: string; message?: string; session?: string }
    let data: SessionResponse
    try {
      data = (await response.json()) as SessionResponse
    } catch {
      data = {}
    }
    if (!response.ok) {
      if (data.error === 'OTP_REQUIRED') {
        throw new OtpRequiredError({
          canRequestOtp: !!(walletConfig.requestWalletRecoverOTP || walletConfig.requestWalletRecoverOTPEndpoint),
          cause: new Error('OTP_REQUIRED'),
        })
      }
      const errMsg =
        typeof (data.error ?? data.message) === 'string'
          ? `Failed to create encryption session: ${data.error ?? data.message}`
          : 'Failed to create encryption session'
      throw new RecoveryError(errMsg, data.error == null ? {} : { details: String(data.error) })
    }

    const session = data.session
    if (typeof session !== 'string' || session.length === 0) {
      throw new RecoveryError('Invalid encryption session response.', {
        details: 'The response body carried no `session` string.',
      })
    }
    return session
  }

  throw new OpenfortConfigError('No encryption session method configured.', {
    metaMessages: ['Provide `getEncryptionSession` or `createEncryptedSessionEndpoint` in `walletConfig`.'],
  })
}
