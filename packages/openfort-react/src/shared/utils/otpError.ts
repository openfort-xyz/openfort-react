import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'

type HandleOtpErrorResult = {
  error: OpenfortError
  isOTPRequired: boolean
}

/** Normalizes OTP_REQUIRED errors and returns user-friendly messages. */
export function handleOtpRecoveryError(error: Error | unknown, hasWalletRecoveryOTP: boolean): HandleOtpErrorResult {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg !== 'OTP_REQUIRED') {
    const normalized =
      error instanceof OpenfortError ? error : new OpenfortError(msg, OpenfortReactErrorType.UNEXPECTED_ERROR)
    return { error: normalized, isOTPRequired: false }
  }

  const newError = hasWalletRecoveryOTP
    ? new OpenfortError('OTP code is required to recover the wallet.', OpenfortReactErrorType.WALLET_ERROR)
    : new OpenfortError(
        'OTP code is required to recover the wallet.\nPlease set requestWalletRecoveryOTP or requestWalletRecoveryOTPEndpoint in OpenfortProvider.',
        OpenfortReactErrorType.WALLET_ERROR
      )

  return { error: newError, isOTPRequired: true }
}
