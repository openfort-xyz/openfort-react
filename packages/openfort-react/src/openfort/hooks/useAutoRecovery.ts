'use client'

import { EmbeddedState, type Openfort, RecoveryMethod } from '@openfort/openfort-js'
import { useEffect, useRef } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import {
  captureEmbeddedSignerSession,
  isEmbeddedSignerOperationInvalidationError,
  runEmbeddedSignerOperation,
} from '../../shared/utils/embeddedSignerOperationQueue.js'
import { buildRecoveryParams } from '../../shared/utils/recovery.js'
import { logger } from '../../utils/logger.js'
import type { OpenfortStore } from '../store.js'

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
  const attemptGenerationRef = useRef(0)
  const attemptTailRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (storeEmbeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (!storeActiveEmbeddedAddress) return
    if (!openfort || !walletConfig) return
    const accounts = store.getState().embeddedAccounts
    if (!accounts?.length) return

    const normalizedTarget = storeActiveEmbeddedAddress.toLowerCase()
    const account = accounts.find((a) => a.address.toLowerCase() === normalizedTarget)
    if (!account) return
    // PASSWORD recovery requires explicit user input — skip auto-recover.
    if (account.recoveryMethod === RecoveryMethod.PASSWORD) return

    // Reset any stale error from a previous attempt before starting fresh.
    store.getState().setRecoveryError(null)
    const generation = ++attemptGenerationRef.current
    const isCurrentAttempt = () => attemptGenerationRef.current === generation

    logger.log('[auto-recover] starting', {
      address: account.address,
      method: account.recoveryMethod,
    })

    const run = async () => {
      if (!isCurrentAttempt()) return
      const signerSession = captureEmbeddedSignerSession(openfort)
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
        signerSession.assertCurrent()
      } catch (err) {
        if (!isCurrentAttempt()) return
        if (isEmbeddedSignerOperationInvalidationError(err)) return
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error('[auto-recover] failed to build recovery params', error)
        store.getState().setRecoveryError(error)
        return
      }

      if (!isCurrentAttempt()) return

      // Stage 2: configure the embedded signer.
      logger.log('[auto-recover] configuring signer...')
      try {
        await runEmbeddedSignerOperation(openfort, async ({ assertCurrent }) => {
          if (!isCurrentAttempt()) return
          signerSession.assertCurrent()
          assertCurrent()
          await openfort.embeddedWallet.recover({ account: account.id, recoveryParams })
        })
        if (!isCurrentAttempt()) return
        store.getState().setEmbeddedState(EmbeddedState.READY)
        logger.log('[auto-recover] succeeded — signer ready', { address: account.address })
      } catch (err) {
        if (!isCurrentAttempt()) return
        if (isEmbeddedSignerOperationInvalidationError(err)) return
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

    const queuedAttempt = attemptTailRef.current.then(run, run)
    attemptTailRef.current = queuedAttempt.then(
      () => undefined,
      () => undefined
    )

    return () => {
      if (isCurrentAttempt()) attemptGenerationRef.current += 1
    }
  }, [storeEmbeddedState, storeActiveEmbeddedAddress, openfort, walletConfig, store])
}
