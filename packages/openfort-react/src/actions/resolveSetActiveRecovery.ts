import { RecoveryMethod, type RecoveryParams } from '@openfort/openfort-js'
import type { SetActiveEmbeddedWalletOptionsBase } from '../shared/types.js'
import type { BuildRecoveryParamsConfig } from '../shared/utils/recovery.js'
import { buildRecoveryParams } from '../shared/utils/recovery.js'

/** Minimal account shape the recovery decision needs. */
type RecoverableAccount = {
  recoveryMethod?: RecoveryMethod
  recoveryMethodDetails?: { passkeyId?: string }
}

type ResolveSetActiveRecoveryResult = { needsRecovery: true } | { needsRecovery: false; recoveryParams: RecoveryParams }

/**
 * Decides which recovery params unlock `account` for a `setActive` call.
 *
 * Explicit `recoveryParams` win outright. Otherwise, when the caller supplied no
 * recovery input at all, the account's own recovery method decides: passkeys
 * reuse the stored passkey id, automatic accounts mint a fresh encryption
 * session, and password accounts report `needsRecovery` so the caller can prompt
 * for the password. Any explicit input (method, password or passkey id) is
 * resolved through `buildRecoveryParams` instead.
 *
 * @param account - Account being activated.
 * @param activeOptions - Recovery-related options passed to `setActive`.
 * @param config - Wallet config plus identity accessors for encryption sessions.
 * @returns Either the resolved recovery params, or a `needsRecovery` marker.
 */
export async function resolveSetActiveRecovery(
  account: RecoverableAccount,
  activeOptions: SetActiveEmbeddedWalletOptionsBase,
  config: BuildRecoveryParamsConfig
): Promise<ResolveSetActiveRecoveryResult> {
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
