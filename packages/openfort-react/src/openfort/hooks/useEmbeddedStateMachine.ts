'use client'

import { type EmbeddedAccount, EmbeddedState, type Openfort, type User } from '@openfort/openfort-js'
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { logger } from '../../utils/logger'
import type { OpenfortStore } from '../store'

type Params = {
  openfort: Openfort
  storeEmbeddedState: OpenfortStore['embeddedState']
  storeUser: OpenfortStore['user']
  store: StoreApi<OpenfortStore>
  updateUserRef: MutableRefObject<(user?: User, logoutOnError?: boolean) => Promise<User | null>>
  fetchEmbeddedAccountsRef: MutableRefObject<(options?: { silent?: boolean }) => Promise<EmbeddedAccount[]>>
}

type Result = {
  isConnectedWithEmbeddedSigner: boolean
  setIsConnectedWithEmbeddedSigner: Dispatch<SetStateAction<boolean>>
  connectingRef: MutableRefObject<boolean>
}

/**
 * Reacts to embedded state transitions and performs the appropriate side effects:
 *
 * - UNAUTHENTICATED → clears the store user
 * - EMBEDDED_SIGNER_NOT_CONFIGURED → resets connect state, validates token, fetches accounts
 * - READY → polls until user is confirmed in the store
 *
 * Returns `isConnectedWithEmbeddedSigner`, its setter, and `connectingRef` so that
 * the bridge-connect effect and `logout` in CoreOpenfortProvider can share them.
 */
export function useEmbeddedStateMachine({
  openfort,
  storeEmbeddedState,
  storeUser,
  store,
  updateUserRef,
  fetchEmbeddedAccountsRef,
}: Params): Result {
  const [isConnectedWithEmbeddedSigner, setIsConnectedWithEmbeddedSigner] = useState(false)
  const connectingRef = useRef(false)

  const userRef = useRef(storeUser)
  useLayoutEffect(() => {
    userRef.current = storeUser
  }, [storeUser])

  useEffect(() => {
    if (!openfort) return
    let cancelled = false

    switch (storeEmbeddedState) {
      case EmbeddedState.NONE:
      case EmbeddedState.CREATING_ACCOUNT:
        break
      case EmbeddedState.UNAUTHENTICATED:
        store.getState().setUser(null)
        break

      case EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED: {
        connectingRef.current = false
        setIsConnectedWithEmbeddedSigner(false)

        // Validate token and fetch accounts. Auto-recovery is handled by the
        // dedicated useAutoRecovery hook (keyed on storeActiveEmbeddedAddress).
        // Never auto-logout here: during first OAuth sign-in the user isn't in
        // the store yet and user.get() may briefly 401/404 before the token
        // propagates — logging out would abort the entire auth flow.
        const doFetch = async () => {
          updateUserRef.current(undefined, false)
          await fetchEmbeddedAccountsRef.current()
        }
        doFetch().catch((err) => {
          if (!cancelled) {
            logger.error('EMBEDDED_SIGNER_NOT_CONFIGURED flow failed', err)
          }
        })
        break
      }

      case EmbeddedState.READY: {
        const pollUserUntilReady = async () => {
          for (let i = 0; i < 5; i++) {
            if (cancelled) return
            try {
              const user = await updateUserRef.current(undefined, true)
              if (user) break
            } catch (_err) {}
            await new Promise((resolve) => setTimeout(resolve, 250))
          }
        }
        pollUserUntilReady()
        break
      }

      default:
        throw new Error(`Unknown embedded state: ${storeEmbeddedState}`)
    }

    return () => {
      cancelled = true
    }
  }, [storeEmbeddedState, openfort, store])

  return { isConnectedWithEmbeddedSigner, setIsConnectedWithEmbeddedSigner, connectingRef }
}
