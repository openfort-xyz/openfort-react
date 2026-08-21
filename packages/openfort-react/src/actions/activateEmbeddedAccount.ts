import type { EmbeddedAccount } from '@openfort/openfort-js'
import { logger } from '../utils/logger.js'

type ActivateEmbeddedAccountParameters = {
  /** Freshly created or imported account. */
  account: EmbeddedAccount
  /** Verifies that the session which created the account can still publish it. */
  assertCurrent: () => void
  /** Reports whether this wallet mutation still owns consumer-facing publication. */
  shouldPublish: () => boolean
  /** Publishes the active address to the core store. */
  setActiveEmbeddedAddress: (address: string | undefined) => void
  /** Refetches the embedded accounts list into the core store. */
  updateEmbeddedAccounts: (options?: { silent?: boolean }) => Promise<EmbeddedAccount[] | undefined>
}

/**
 * Publishes a newly minted account as the active embedded wallet.
 *
 * The active address is set *before* the accounts list is refetched, and before
 * the caller moves to a connected state. Refetching first opens a window where
 * the wallet sync effect observes `status: 'connected'` with no
 * `activeEmbeddedAddress` and disconnects — which is exactly what happens for
 * the very first wallet, while `embeddedAccounts` is still empty.
 * The refresh is best-effort because the remote account already exists; a list
 * outage must not turn successful creation into a retry that creates another wallet.
 *
 * @param parameters - Account, publication guards and core-store writers.
 */
export async function activateEmbeddedAccount(parameters: ActivateEmbeddedAccountParameters): Promise<void> {
  const { account, assertCurrent, shouldPublish, setActiveEmbeddedAddress, updateEmbeddedAccounts } = parameters

  assertCurrent()
  if (!shouldPublish()) return
  setActiveEmbeddedAddress(account.address)
  try {
    await updateEmbeddedAccounts({ silent: true })
  } catch (error) {
    logger.warn('[embedded-wallet] account was activated but the account list could not be refreshed', error)
  }
}
