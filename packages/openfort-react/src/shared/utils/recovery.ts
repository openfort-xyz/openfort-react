import { RecoveryMethod, type RecoveryParams } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'

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
        throw new OpenfortError('Access token not found', OpenfortReactErrorType.AUTHENTICATION_ERROR)
      }

      const userId = await getUserId()
      if (!userId) {
        throw new OpenfortError('User not found', OpenfortReactErrorType.AUTHENTICATION_ERROR)
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
        throw new OpenfortError('Password is required', OpenfortReactErrorType.CONFIGURATION_ERROR)
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
      throw new OpenfortError('Unsupported recovery method', OpenfortReactErrorType.UNEXPECTED_ERROR, {
        recoveryMethod,
      })
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
    throw new OpenfortError('Wallet config not found', OpenfortReactErrorType.CONFIGURATION_ERROR)
  }

  if (walletConfig.getEncryptionSession) {
    const session = await walletConfig.getEncryptionSession({ accessToken, userId, otpCode })
    if (typeof session !== 'string' || session.length === 0) {
      throw new OpenfortError('getEncryptionSession returned invalid session', OpenfortReactErrorType.WALLET_ERROR)
    }
    return session
  }

  if (walletConfig.createEncryptedSessionEndpoint) {
    const response = await fetch(walletConfig.createEncryptedSessionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
    })

    type SessionResponse = { error?: string; message?: string; session?: string }
    let data: SessionResponse
    try {
      data = (await response.json()) as SessionResponse
    } catch {
      data = {}
    }
    if (!response.ok) {
      if (data.error === 'OTP_REQUIRED') {
        throw new OpenfortError('OTP verification required', OpenfortReactErrorType.AUTHENTICATION_ERROR)
      }
      const errMsg =
        typeof (data.error ?? data.message) === 'string'
          ? `Failed to create encryption session: ${data.error ?? data.message}`
          : 'Failed to create encryption session'
      throw new OpenfortError(errMsg, OpenfortReactErrorType.WALLET_ERROR, {
        error: data.error != null ? new Error(String(data.error)) : undefined,
      })
    }

    const session = data.session
    if (typeof session !== 'string' || session.length === 0) {
      throw new OpenfortError('Invalid encryption session response', OpenfortReactErrorType.WALLET_ERROR)
    }
    return session
  }

  throw new OpenfortError(
    'No encryption session method configured. Provide getEncryptionSession or createEncryptedSessionEndpoint in walletConfig.',
    OpenfortReactErrorType.CONFIGURATION_ERROR
  )
}
