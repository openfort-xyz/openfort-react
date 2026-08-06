import type { EmbeddedAccount, Openfort, RecoveryParams } from '@openfort/openfort-js'
import { asOpenfortError } from '../errors/base.js'
import { RecoveryError } from '../errors/wallet.js'
import { logger } from '../utils/logger.js'

type SetRecoveryMethodParameters = {
  client: Openfort
  /** Recovery params that currently unlock the wallet. */
  previousRecovery: RecoveryParams
  /** Recovery params to switch to. */
  newRecovery: RecoveryParams
  /** Refetches the embedded accounts list so the new method is reflected. */
  updateEmbeddedAccounts: (options?: { silent?: boolean }) => Promise<EmbeddedAccount[] | undefined>
}

/**
 * Re-encrypts the active wallet's key share under a new recovery method and
 * refreshes the accounts list.
 *
 * @param parameters - Client, both recovery params and the accounts refetcher.
 * @throws {RecoveryError} When the core SDK rejects the change.
 */
export async function setRecoveryMethod(parameters: SetRecoveryMethodParameters): Promise<void> {
  const { client, previousRecovery, newRecovery, updateEmbeddedAccounts } = parameters

  try {
    await client.embeddedWallet.setRecoveryMethod(previousRecovery, newRecovery)
  } catch (err) {
    throw asOpenfortError(err, (cause) => new RecoveryError('Failed to set recovery method.', { cause }))
  }

  // The recovery method has already changed; a stale list is not worth
  // reporting the successful change as a failure.
  try {
    await updateEmbeddedAccounts({ silent: true })
  } catch (err) {
    logger.warn('[embedded-wallet] recovery method was changed but the account list could not be refreshed', err)
  }
}
