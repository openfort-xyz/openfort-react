'use client'

import { type ChainTypeEnum, EmbeddedState, type Openfort } from '@openfort/openfort-js'
import { useEffect, useRef } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import { firstEmbeddedAddress } from '../../core/strategyUtils'
import type { OpenfortStore } from '../store'

type Params = {
  openfort: Openfort
  storeEmbeddedAccounts: OpenfortStore['embeddedAccounts']
  storeEmbeddedState: OpenfortStore['embeddedState']
  storeActiveEmbeddedAddress: OpenfortStore['activeEmbeddedAddress']
  chainType: ChainTypeEnum
  store: StoreApi<OpenfortStore>
  walletConfig: OpenfortWalletConfig | undefined
}

/**
 * Syncs the active embedded address into the store.
 *
 * - Clears address when there are no accounts or user is logged out.
 * - When connectOnLogin is false and the session went through
 *   EMBEDDED_SIGNER_NOT_CONFIGURED (login flow), skips auto-seeding at READY
 *   so the user must pick a wallet explicitly.
 * - Returning sessions (SDK starts directly at READY) always auto-seed.
 */
export function useActiveAddressSync({
  openfort,
  storeEmbeddedAccounts,
  storeEmbeddedState,
  storeActiveEmbeddedAddress,
  chainType,
  store,
  walletConfig,
}: Params): void {
  const connectOnLogin = walletConfig?.connectOnLogin ?? true

  // Track whether the current session went through EMBEDDED_SIGNER_NOT_CONFIGURED
  // (i.e. a login flow, not a returning session). When connectOnLogin is false, we
  // skip auto-seeding at READY only for login flows — returning sessions (where the
  // SDK starts directly at READY with a configured signer) should always auto-seed.
  const sawSignerNotConfiguredRef = useRef(false)

  useEffect(() => {
    if (!openfort || !storeEmbeddedAccounts?.length) {
      // Only clear the address on genuine logout (no user). During wallet creation
      // the accounts list is briefly empty while updateEmbeddedAccounts refetches —
      // clearing here would undo the address that create() just set.
      if (!storeEmbeddedAccounts?.length && !store.getState().user) {
        store.getState().setActiveEmbeddedAddress(undefined)
      }
      return
    }

    // Terminal non-READY states: clear only on genuine logout (no user).
    // During OAuth the state passes through UNAUTHENTICATED → EMBEDDED_SIGNER_NOT_CONFIGURED → READY
    // while accounts and address are already set. Clearing here would undo that.
    if (storeEmbeddedState === EmbeddedState.UNAUTHENTICATED || storeEmbeddedState === EmbeddedState.NONE) {
      if (!store.getState().user) {
        store.getState().setActiveEmbeddedAddress(undefined)
        sawSignerNotConfiguredRef.current = false
      }
      return
    }

    // Bootstrap recovery: when signer is not yet configured and no address is set,
    // seed the active address so useAutoRecovery can trigger and drive state → READY.
    // Skip when connectOnLogin is false — the user should explicitly choose a wallet.
    if (storeEmbeddedState === EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) {
      sawSignerNotConfiguredRef.current = true
      if (connectOnLogin && storeActiveEmbeddedAddress === undefined) {
        const first = firstEmbeddedAddress(storeEmbeddedAccounts, chainType)
        if (first) store.getState().setActiveEmbeddedAddress(first)
      }
      return
    }

    if (storeEmbeddedState !== EmbeddedState.READY) {
      return
    }

    // Already have an address — nothing to resolve
    if (storeActiveEmbeddedAddress !== undefined) return

    // Login flow with connectOnLogin=false: the session went through
    // EMBEDDED_SIGNER_NOT_CONFIGURED, so don't auto-seed. The user must pick
    // a wallet via the UI. create() and setActive() set the address directly,
    // so they bypass this check.
    if (!connectOnLogin && sawSignerNotConfiguredRef.current) {
      return
    }

    // Priority 1: ask the SDK for its active wallet
    let cancelled = false
    openfort.embeddedWallet
      .get()
      .then((active) => {
        if (cancelled) return
        const addr = active?.address
        if (addr) {
          store.getState().setActiveEmbeddedAddress(addr)
          return
        }
        // Priority 2: fallback to first account for current chain
        const first = firstEmbeddedAddress(storeEmbeddedAccounts, chainType)
        if (first) store.getState().setActiveEmbeddedAddress(first)
      })
      .catch((_err) => {
        if (cancelled) return
        const first = firstEmbeddedAddress(storeEmbeddedAccounts, chainType)
        if (first) store.getState().setActiveEmbeddedAddress(first)
      })
    return () => {
      cancelled = true
    }
  }, [
    openfort,
    storeEmbeddedAccounts,
    storeEmbeddedState,
    storeActiveEmbeddedAddress,
    chainType,
    store,
    connectOnLogin,
  ])
}
