import type { Openfort, RecoveryParams } from '@openfort/openfort-js'

/** Outcome of asking the signer to hold an account. */
export type EnsureEmbeddedSignerResult =
  /** The signer already held the account; nothing was recovered. */
  | 'already-held'
  /** The account was recovered into the signer. */
  | 'recovered'
  /** Recovery needs a credential the caller has to collect first (a password). */
  | 'needs-credential'

type EnsureEmbeddedSignerParameters = {
  client: Openfort
  /** Embedded account that must end up held by the signer. */
  accountId: string
  /**
   * Produces the credential for this account, or `null` when the caller cannot
   * supply one yet. Invoked only when a recovery is actually going to run, so a
   * redundant request costs no encryption session and no WebAuthn ceremony.
   */
  buildRecoveryParams: () => Promise<RecoveryParams | null>
  /** Rejects work reserved by a wallet session that is no longer current. */
  assertCurrent?: () => void
}

/**
 * Brings the embedded signer to the point where it holds `accountId`.
 *
 * This is the only place that calls `embeddedWallet.recover()`. Recovery is
 * requested from three independent places on a single login — the provider's
 * auto-recovery effect, the modal's recover page through `setActive`, and the
 * post-authentication connect path — and each one used to decide for itself
 * whether a recovery was still needed. They decided at different moments (one
 * during render, one when scheduling, one while running), so they disagreed,
 * and a passkey account answered one WebAuthn ceremony per caller that got it
 * wrong.
 *
 * Callers declare the account they want held and let this decide. Asking for an
 * account the signer already holds is a no-op rather than a second credential
 * prompt.
 *
 * Callers must already hold the embedded-signer operation queue: this reads and
 * replaces the signer, and the queue is what keeps that ordered against other
 * signer work. Because that queue is strictly serial, two requests for the same
 * account can never overlap — the second one runs after the first has settled
 * and sees the account already held. If recovery ever moves off the queue, this
 * is where concurrent requests would have to collapse onto one promise.
 *
 * @param parameters - Client, target account, and how to build its credential.
 * @returns Whether the account was already held, recovered, or still needs a credential.
 */
export async function ensureEmbeddedSignerHolds(
  parameters: EnsureEmbeddedSignerParameters
): Promise<EnsureEmbeddedSignerResult> {
  const { client, accountId, buildRecoveryParams, assertCurrent } = parameters

  if (await signerHolds(client, accountId)) return 'already-held'

  assertCurrent?.()
  const recoveryParams = await buildRecoveryParams()
  if (!recoveryParams) return 'needs-credential'

  assertCurrent?.()
  await client.embeddedWallet.recover({ account: accountId, recoveryParams })
  return 'recovered'
}

/** Whether the signer currently holds the key share for `accountId`. */
async function signerHolds(client: Openfort, accountId: string): Promise<boolean> {
  try {
    const current = await client.embeddedWallet.get()
    return current?.id === accountId
  } catch {
    // `get()` throws when no signer is configured, which is the common case here
    // and not worth distinguishing from a genuine lookup failure: both mean the
    // account still has to be recovered.
    return false
  }
}
