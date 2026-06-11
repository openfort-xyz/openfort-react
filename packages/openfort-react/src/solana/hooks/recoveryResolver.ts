import { RecoveryMethod, type RecoveryParams } from '@openfort/openfort-js'
import type { BuildRecoveryParamsConfig } from '../../shared/utils/recovery'
import { buildRecoveryParams } from '../../shared/utils/recovery'
import type { SetActiveSolanaWalletOptions } from '../types'

type ResolveRecoveryResult = { needsRecovery: true } | { needsRecovery: false; recoveryParams: RecoveryParams }

export async function resolveRecoveryForSetActive(
  account: { recoveryMethod?: RecoveryMethod; recoveryMethodDetails?: { passkeyId?: string } },
  activeOptions: SetActiveSolanaWalletOptions,
  config: BuildRecoveryParamsConfig
): Promise<ResolveRecoveryResult> {
  const password = activeOptions.password
  const hasExplicitRecovery =
    activeOptions.recoveryParams != null || password != null || activeOptions.recoveryMethod !== undefined

  if (activeOptions.recoveryParams) {
    return { needsRecovery: false, recoveryParams: activeOptions.recoveryParams }
  }

  if (!hasExplicitRecovery) {
    const method = account.recoveryMethod ?? RecoveryMethod.AUTOMATIC
    if (method === RecoveryMethod.PASSKEY) {
      const passkeyId = activeOptions.passkeyId ?? account.recoveryMethodDetails?.passkeyId
      return {
        needsRecovery: false,
        recoveryParams: {
          recoveryMethod: RecoveryMethod.PASSKEY,
          ...(passkeyId && { passkeyInfo: { passkeyId } }),
        } as RecoveryParams,
      }
    }
    if (method === RecoveryMethod.PASSWORD) {
      return { needsRecovery: true }
    }
    const recoveryParams = await buildRecoveryParams(
      { recoveryMethod: undefined, otpCode: activeOptions.otpCode },
      config
    )
    return { needsRecovery: false, recoveryParams }
  }

  const recoveryParams = await buildRecoveryParams(
    {
      recoveryMethod: activeOptions.recoveryMethod ?? (password != null ? RecoveryMethod.PASSWORD : undefined),
      passkeyId: activeOptions.passkeyId ?? account.recoveryMethodDetails?.passkeyId,
      password,
      otpCode: activeOptions.otpCode,
    },
    config
  )
  return { needsRecovery: false, recoveryParams }
}
