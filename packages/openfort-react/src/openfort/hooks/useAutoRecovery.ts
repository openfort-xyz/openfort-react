'use client'

import { EmbeddedState, type Openfort, RecoveryMethod } from '@openfort/openfort-js'
import { useEffect, useRef } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import { buildRecoveryParams } from '../../shared/utils/recovery'
import { logger } from '../../utils/logger'
import type { OpenfortStore } from '../store'

type Params = {
  storeEmbeddedState: OpenfortStore['embeddedState']
  storeActiveEmbeddedAddress: OpenfortStore['activeEmbeddedAddress']
  openfort: Openfort | null
  walletConfig: OpenfortWalletConfig | undefined
  store: StoreApi<OpenfortStore>
}

/**
 * Auto-recover: when the SDK reaches EMBEDDED_SIGNER_NOT_CONFIGURED with a known
 * active address, attempts to configure the signer via recover() → READY.
 *
 * Reads embeddedAccounts imperatively from the store (not as a dep) so that
 * fetchEmbeddedAccounts updating the store mid-recovery does not re-trigger the
 * effect and cancel the closure before recover() runs.
 *
 * PASSWORD recovery is skipped — it requires explicit user input.
 *
 * On failure: surfaces recoveryError in the store. Does NOT auto-create a new wallet
 * because silently replacing a wallet can strand the user's funds.
 */
export function useAutoRecovery({
  storeEmbeddedState,
  storeActiveEmbeddedAddress,
  openfort,
  walletConfig,
  store,
}: Params): void {
  const autoRecoverInProgressRef = useRef(false)

  useEffect(() => {
    if (storeEmbeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (!storeActiveEmbeddedAddress) return
    if (!openfort || !walletConfig) return
    if (autoRecoverInProgressRef.current) return

    const accounts = store.getState().embeddedAccounts
    if (!accounts?.length) return

    const normalizedTarget = storeActiveEmbeddedAddress.toLowerCase()
    const account = accounts.find((a) => a.address.toLowerCase() === normalizedTarget)
    if (!account) return
    // PASSWORD recovery requires explicit user input — skip auto-recover.
    if (account.recoveryMethod === RecoveryMethod.PASSWORD) return

    // Reset any stale error from a previous attempt before starting fresh.
    store.getState().setRecoveryError(null)
    autoRecoverInProgressRef.current = true
    let cancelled = false

    logger.log('[auto-recover] starting', {
      address: account.address,
      method: account.recoveryMethod,
    })

    const run = async () => {
      // Stage 1: build recovery params (may trigger a passkey prompt for PASSKEY method).
      logger.log('[auto-recover] building recovery params...')
      let recoveryParams: Awaited<ReturnType<typeof buildRecoveryParams>>
      try {
        recoveryParams = await buildRecoveryParams(
          {
            recoveryMethod: account.recoveryMethod === RecoveryMethod.PASSKEY ? RecoveryMethod.PASSKEY : undefined,
            passkeyId:
              account.recoveryMethod === RecoveryMethod.PASSKEY ? account.recoveryMethodDetails?.passkeyId : undefined,
          },
          {
            walletConfig,
            getAccessToken: () => openfort.getAccessToken(),
            getUserId: async () => (await openfort.user.get())?.id,
          }
        )
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error('[auto-recover] failed to build recovery params', error)
        store.getState().setRecoveryError(error)
        return
      }

      if (cancelled) return

      // Stage 2: configure the embedded signer.
      logger.log('[auto-recover] configuring signer...')
      try {
        await openfort.embeddedWallet.recover({ account: account.id, recoveryParams })
        if (cancelled) return
        logger.log('[auto-recover] succeeded — signer ready', { address: account.address })
        // recoveryError clears automatically in the store subscriber when embeddedState → READY.
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error(
          '[auto-recover] recover() failed — signer could not be configured. ' +
            'This typically happens on a new device or after local storage was cleared. ' +
            'Read `recoveryError` from useOpenfortCore() and prompt the user to create a new wallet.',
          error
        )
        store.getState().setRecoveryError(error)
      }
    }

    run().finally(() => {
      autoRecoverInProgressRef.current = false
    })

    return () => {
      cancelled = true
    }
  }, [storeEmbeddedState, storeActiveEmbeddedAddress, openfort, walletConfig, store])
}
