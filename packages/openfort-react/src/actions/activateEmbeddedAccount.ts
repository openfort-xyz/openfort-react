import type { EmbeddedAccount } from '@openfort/openfort-js'

type ActivateEmbeddedAccountParameters = {
  /** Freshly created or imported account. */
  account: EmbeddedAccount
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
 *
 * @param parameters - Account plus the two core-store writers.
 */
export async function activateEmbeddedAccount(parameters: ActivateEmbeddedAccountParameters): Promise<void> {
  const { account, setActiveEmbeddedAddress, updateEmbeddedAccounts } = parameters

  setActiveEmbeddedAddress(account.address)
  await updateEmbeddedAccounts({ silent: true })
}
