import type { EmbeddedAccount, Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../components/Openfort/types.js'
import type { SetActiveEmbeddedWalletOptionsBase } from '../shared/types.js'
import { buildClientRecoveryConfig } from './buildClientRecoveryConfig.js'
import { resolveSetActiveRecovery } from './resolveSetActiveRecovery.js'

type SetActiveWalletParameters = {
  client: Openfort
  walletConfig: OpenfortWalletConfig | undefined
  /** Account to activate, already resolved from the caller's address. */
  account: EmbeddedAccount
  /** Recovery-related options passed to `setActive`. */
  options: SetActiveEmbeddedWalletOptionsBase
}

type SetActiveWalletResult = {
  /**
   * `true` when the account is password-protected and no password was supplied.
   * The key share stays locked; the caller must collect a password and retry.
   */
  needsRecovery: boolean
}

/**
 * Unlocks an embedded account's key share so it can sign.
 *
 * @param parameters - Client, wallet config, target account and recovery options.
 * @returns Whether the caller still has to collect a recovery password.
 */
export async function setActiveWallet(parameters: SetActiveWalletParameters): Promise<SetActiveWalletResult> {
  const { client, walletConfig, account, options } = parameters

  const resolved = await resolveSetActiveRecovery(account, options, buildClientRecoveryConfig(client, walletConfig))

  if (resolved.needsRecovery) {
    return { needsRecovery: true }
  }

  await client.embeddedWallet.recover({ account: account.id, recoveryParams: resolved.recoveryParams })

  return { needsRecovery: false }
}
