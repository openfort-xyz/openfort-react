import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP'
import type { RecoverableWallet } from '../../../shared/types'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError'
import { routes, type SetRouteOptions } from '../../Openfort/types'

type RecoveryContext = {
  setActive: (opts: {
    address: string
    password?: string
    recoveryMethod?: RecoveryMethod
    otpCode?: string
    passkeyId?: string
  }) => Promise<void>
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

async function passwordEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<void> {
  ctx.setError(false)
  await ctx.setActive({
    address: wallet.address,
    recoveryMethod: RecoveryMethod.PASSWORD,
    password: ctx.password,
  })
  ctx.setRoute(routes.CONNECTED_SUCCESS)
}

async function passkeyEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<void> {
  ctx.setError(false)
  await ctx.setActive({
    address: wallet.address,
    recoveryMethod: RecoveryMethod.PASSKEY,
    passkeyId: ctx.passkeyId,
  })
  ctx.setRoute(routes.CONNECTED_SUCCESS)
}

async function automaticEntry(wallet: RecoverableWallet, ctx: RecoveryContext): Promise<void> {
  ctx.setError(false)
  try {
    await ctx.setActive({
      address: wallet.address,
      recoveryMethod: RecoveryMethod.AUTOMATIC,
      otpCode: ctx.otpCode,
    })
    ctx.setRoute(routes.CONNECTED_SUCCESS)
  } catch (err) {
    const { error, isOTPRequired } = handleOtpRecoveryError(err, ctx.otp.isEnabled)
    if (isOTPRequired && ctx.otp.isEnabled) {
      try {
        const res = await ctx.otp.request()
        ctx.setNeedsOTP(true)
        ctx.setOtpResponse(res)
      } catch (_otpErr) {
        ctx.setError('Failed to send recovery code')
      }
    } else {
      ctx.setError(error.message)
    }
  }
}

type RecoveryRegistryByChain = {
  password: RecoveryEntry
  passkey: RecoveryEntry
  automatic: RecoveryEntry
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
