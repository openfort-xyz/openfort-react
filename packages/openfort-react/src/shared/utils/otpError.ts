import { OpenfortError, toError } from '../../errors/base.js'
import { OtpRequiredError } from '../../errors/wallet.js'

type HandleOtpErrorResult = {
  error: OpenfortError
  isOTPRequired: boolean
}

/**
 * `OTP_REQUIRED` is the sentinel `openfort-js` throws when a recovery share is
 * gated behind a one-time code. It arrives as a bare `Error` with no class of
 * its own, so the message is the only thing to match on.
 */
function isOtpRequired(error: unknown): boolean {
  if (!(error instanceof OpenfortError)) return toError(error).message === 'OTP_REQUIRED'
  if (error.shortMessage === 'OTP_REQUIRED') return true
  const match = error.walk((cause) => cause instanceof Error && cause.message === 'OTP_REQUIRED')
  return match instanceof Error && match.message === 'OTP_REQUIRED'
}

/** Classifies a recovery failure, turning the OTP sentinel into a typed error. */
export function handleOtpRecoveryError(error: Error | unknown, hasWalletRecoveryOTP: boolean): HandleOtpErrorResult {
  if (!isOtpRequired(error)) {
    const normalized =
      error instanceof OpenfortError ? error : new OpenfortError('Wallet recovery failed.', { cause: toError(error) })
    return { error: normalized, isOTPRequired: false }
  }

  return { error: new OtpRequiredError({ canRequestOtp: hasWalletRecoveryOTP }), isOTPRequired: true }
}
