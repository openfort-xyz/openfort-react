import { EmbeddedState } from '@openfort/openfort-js'
import type { OpenfortStore } from './openfortStore'

export function selectIsLoading(state: OpenfortStore, address: string | undefined): boolean {
  const { embeddedState, user } = state

  switch (embeddedState) {
    case EmbeddedState.NONE:
    case EmbeddedState.CREATING_ACCOUNT:
      return true

    case EmbeddedState.UNAUTHENTICATED:
      if (user) return true
      return false

    case EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED:
      if (!user) return true
      return false

    case EmbeddedState.READY:
      if (!address || !user) return true
      return false

    default:
      return true
  }
}

export function selectNeedsRecovery(state: OpenfortStore, address: string | undefined): boolean {
  return state.embeddedState === EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED && !address
}
