import { EmbeddedState } from '@openfort/openfort-js'
import type { OpenfortStore } from './store.js'

export const selectUser = (s: OpenfortStore) => s.user
export const selectEmbeddedState = (s: OpenfortStore) => s.embeddedState
export const selectIsLoading = (s: OpenfortStore) => s.isLoading
/**
 * Whether the user holds a session.
 *
 * Everything past `UNAUTHENTICATED` counts, including `CREATING_ACCOUNT`: the
 * user has signed in by then and only their embedded wallet is still being
 * provisioned, so treating that state as signed-out would flip the flag off and
 * back on mid-signup. Use `useUser().isConnected` for "signed in *and* the
 * wallet is ready".
 */
export const isAuthenticatedState = (embeddedState: EmbeddedState) =>
  embeddedState !== EmbeddedState.NONE && embeddedState !== EmbeddedState.UNAUTHENTICATED

export const selectIsAuthenticated = (s: OpenfortStore) => isAuthenticatedState(s.embeddedState)
export const selectWalletStatus = (s: OpenfortStore) => s.walletStatus
export const selectActiveAddress = (s: OpenfortStore) => s.activeEmbeddedAddress
export const selectChainType = (s: OpenfortStore) => s.chainType
