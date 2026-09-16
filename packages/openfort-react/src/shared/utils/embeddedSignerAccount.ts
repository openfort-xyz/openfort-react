import type { Openfort } from '@openfort/openfort-js'

/**
 * Whether the embedded signer already holds the key share for `accountId`.
 *
 * Recovery is driven from two places on a single login — the provider's
 * auto-recovery effect and the modal's recover page — and both reach
 * `embeddedWallet.recover()` through the same serial queue. Each call derives
 * its own credential, so a passkey account answers a WebAuthn ceremony per
 * call. Whichever one runs second asks the user to repeat themselves for a
 * signer that is already configured.
 *
 * Call this inside the queued operation rather than before it: the first
 * recovery is still waiting on the user while the second is being scheduled,
 * so a check made at scheduling time always reports "not configured".
 *
 * @param client - Openfort client owning the signer.
 * @param accountId - Embedded account the caller wants active.
 * @returns `true` when that account is already the configured signer.
 */
export async function isEmbeddedSignerConfiguredFor(client: Openfort, accountId: string): Promise<boolean> {
  try {
    const current = await client.embeddedWallet.get()
    return current?.id === accountId
  } catch {
    // `get()` throws when no signer is configured, which is the common case
    // here and not worth distinguishing from a genuine lookup failure: both
    // mean the caller still has to recover.
    return false
  }
}
