import { RecoveryMethod } from '@openfort/openfort-js'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP.js'
import type { RecoverableWallet, SetActiveEmbeddedWalletResult } from '../../../shared/types.js'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError.js'
import { routes, type SetRouteOptions } from '../../Openfort/types.js'

/**
 * Callbacks the entries below report through instead of touching React state,
 * so a recovery attempt can keep running inside a persistent operation after
 * the page that started it unmounts.
 */
type RecoveryContext = {
  setActive: (opts: {
    address: string
    password?: string
    recoveryMethod?: RecoveryMethod
    otpCode?: string
    passkeyId?: string
  }) => Promise<SetActiveEmbeddedWalletResult>
  setRoute: (options: SetRouteOptions) => void
  setError: (e: string | false) => void
  otp: { isEnabled: boolean; request: () => Promise<OTPResponse> }
  setNeedsOTP: (n: boolean) => void
  setOtpResponse: (r: OTPResponse | null) => void
  password?: string
  otpCode?: string
  passkeyId?: string
}

export type AutomaticRecoveryOutcome =
  | { status: 'success' }
  | { status: 'needs-recovery' }
  | { status: 'otp-required' }
  | { status: 'error' }

async function credentialRecovery(
  wallet: RecoverableWallet,
  ctx: RecoveryContext,
  recoveryMethod: RecoveryMethod.PASSWORD | RecoveryMethod.PASSKEY
): Promise<void> {
  ctx.setError(false)
  const result = await ctx.setActive({
    address: wallet.address,
    recoveryMethod,
    ...(recoveryMethod === RecoveryMethod.PASSWORD ? { password: ctx.password } : { passkeyId: ctx.passkeyId }),
  })
  if (result.error) {
    ctx.setError(result.error.shortMessage)
  } else if (!result.needsRecovery) {
    ctx.setRoute(routes.CONNECTED_SUCCESS)
  }
}

export const passwordRecovery = (wallet: RecoverableWallet, ctx: RecoveryContext) =>
  credentialRecovery(wallet, ctx, RecoveryMethod.PASSWORD)

export const passkeyRecovery = (wallet: RecoverableWallet, ctx: RecoveryContext) =>
  credentialRecovery(wallet, ctx, RecoveryMethod.PASSKEY)

export async function automaticRecovery(
  wallet: RecoverableWallet,
  ctx: RecoveryContext
): Promise<AutomaticRecoveryOutcome> {
  ctx.setError(false)
  try {
    const result = await ctx.setActive({
      address: wallet.address,
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      otpCode: ctx.otpCode,
    })
    if (result.error) throw result.error
    return result.needsRecovery ? { status: 'needs-recovery' } : { status: 'success' }
  } catch (err) {
    const { error, isOTPRequired } = handleOtpRecoveryError(err, ctx.otp.isEnabled)
    if (isOTPRequired && ctx.otp.isEnabled) {
      try {
        const res = await ctx.otp.request()
        ctx.setNeedsOTP(true)
        ctx.setOtpResponse(res)
        return { status: 'otp-required' }
      } catch (_otpErr) {
        ctx.setError('Failed to send recovery code')
        return { status: 'error' }
      }
    } else {
      ctx.setError(error.shortMessage)
      return { status: 'error' }
    }
  }
}
