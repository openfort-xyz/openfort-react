import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP.js'
import type { RecoverableWallet, SetActiveEmbeddedWalletResult } from '../../../shared/types.js'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError.js'
import { routes, type SetRouteOptions } from '../../Openfort/types.js'

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

type RecoveryEntry = (wallet: RecoverableWallet, ctx: RecoveryContext) => Promise<void>

export type AutomaticRecoveryOutcome =
  | { status: 'success' }
  | { status: 'needs-recovery' }
  | { status: 'otp-required' }
  | { status: 'error' }

async function passwordEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<void> {
  ctx.setError(false)
  const result = await ctx.setActive({
    address: wallet.address,
    recoveryMethod: RecoveryMethod.PASSWORD,
    password: ctx.password,
  })
  if (result.error) {
    ctx.setError(result.error.message)
  } else if (!result.needsRecovery) {
    ctx.setRoute(routes.CONNECTED_SUCCESS)
  }
}

async function passkeyEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<void> {
  ctx.setError(false)
  const result = await ctx.setActive({
    address: wallet.address,
    recoveryMethod: RecoveryMethod.PASSKEY,
    passkeyId: ctx.passkeyId,
  })
  if (result.error) {
    ctx.setError(result.error.message)
  } else if (!result.needsRecovery) {
    ctx.setRoute(routes.CONNECTED_SUCCESS)
  }
}

async function automaticEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<AutomaticRecoveryOutcome> {
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
      ctx.setError(error.message)
      return { status: 'error' }
    }
  }
}

type RecoveryRegistryByChain = {
  password: RecoveryEntry
  passkey: RecoveryEntry
  automatic: (wallet: RecoverableWallet, ctx: RecoveryContext) => Promise<AutomaticRecoveryOutcome>
}

const RECOVERY_REGISTRY: RecoveryRegistryByChain = {
  password: passwordEntry,
  passkey: passkeyEntry,
  automatic: automaticEntry,
}

export const recoveryRegistry: Record<ChainTypeEnum.EVM | ChainTypeEnum.SVM, RecoveryRegistryByChain> = {
  [ChainTypeEnum.EVM]: RECOVERY_REGISTRY,
  [ChainTypeEnum.SVM]: RECOVERY_REGISTRY,
}
