import { EmbeddedState } from '@openfort/openfort-js'
import type { OpenfortStore } from './store'

export const selectUser = (s: OpenfortStore) => s.user
export const selectEmbeddedState = (s: OpenfortStore) => s.embeddedState
export const selectIsLoading = (s: OpenfortStore) => s.isLoading
export const selectIsAuthenticated = (s: OpenfortStore) => {
  const es = s.embeddedState
  return es === EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED || es === EmbeddedState.READY
}
export const selectWalletStatus = (s: OpenfortStore) => s.walletStatus
export const selectActiveAddress = (s: OpenfortStore) => s.activeEmbeddedAddress
export const selectChainType = (s: OpenfortStore) => s.chainType
