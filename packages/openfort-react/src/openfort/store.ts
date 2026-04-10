import type { EmbeddedAccount, Openfort, User, UserAccount } from '@openfort/openfort-js'
import { type ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { WalletFlowStatus } from '../hooks/openfort/walletTypes'

export type OpenfortStoreState = {
  user: User | null
  linkedAccounts: UserAccount[]
  embeddedState: EmbeddedState
  embeddedAccounts: EmbeddedAccount[] | undefined
  isLoadingAccounts: boolean
  activeEmbeddedAddress: string | undefined
  walletStatus: WalletFlowStatus
  chainType: ChainTypeEnum
  isLoading: boolean
  needsRecovery: boolean
  /**
   * Set when auto-recovery fails. Null on success or when cleared by a new auth session.
   * Consumers can read this from `useOpenfortCore()` to show recovery error UI.
   */
  recoveryError: Error | null
}

export type OpenfortStoreActions = {
  setUser: (user: User | null) => void
  setLinkedAccounts: (accounts: UserAccount[]) => void
  setEmbeddedState: (state: EmbeddedState) => void
  setEmbeddedAccounts: (accounts: EmbeddedAccount[] | undefined) => void
  setIsLoadingAccounts: (loading: boolean) => void
  setActiveEmbeddedAddress: (address: string | undefined) => void
  setWalletStatus: (status: WalletFlowStatus) => void
  setChainType: (chainType: ChainTypeEnum) => void
  setRecoveryError: (error: Error | null) => void
  /** Force-recompute isLoading from current state + bridge info. */
  recomputeIsLoading: () => void

  // Injected by CoreOpenfortProvider after mount
  logout: () => Promise<void>
  signUpGuest: () => Promise<void>
  updateUser: (user?: User) => Promise<User | null>
  updateEmbeddedAccounts: (options?: { silent?: boolean }) => Promise<EmbeddedAccount[] | undefined>
  client: Openfort
}

export type OpenfortStore = OpenfortStoreState & OpenfortStoreActions

function computeIsLoading(
  embeddedState: EmbeddedState,
  user: User | null,
  hasBridge: boolean,
  bridgeAddress: string | undefined,
  embeddedAccounts: EmbeddedAccount[] | undefined,
  activeEmbeddedAddress: string | undefined,
  connectOnLogin: boolean
): boolean {
  switch (embeddedState) {
    case EmbeddedState.NONE:
    case EmbeddedState.CREATING_ACCOUNT:
      return true
    case EmbeddedState.UNAUTHENTICATED:
      return !!user
    case EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED:
      return !user
    case EmbeddedState.READY:
      if (!user) return true
      if (hasBridge && !bridgeAddress) return true
      // Embedded accounts exist but active address not yet synced.
      // Only when connectOnLogin is true — when false, address is intentionally
      // not auto-set and the user must pick a wallet via the UI.
      if (connectOnLogin && embeddedAccounts?.length && !activeEmbeddedAddress) return true
      return false
    default:
      return true
  }
}

function computeNeedsRecovery(embeddedState: EmbeddedState, embeddedAccounts: EmbeddedAccount[] | undefined): boolean {
  return embeddedState === EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED && (embeddedAccounts?.length ?? 0) > 0
}

export function createOpenfortStore(
  initialChainType: ChainTypeEnum,
  client: Openfort,
  getBridgeInfo?: () => { hasBridge: boolean; address: string | undefined },
  connectOnLogin = true
): StoreApi<OpenfortStore> {
  const store = createStore<OpenfortStore>((set) => ({
    user: null,
    linkedAccounts: [],
    embeddedState: EmbeddedState.NONE,
    embeddedAccounts: undefined,
    isLoadingAccounts: false,
    activeEmbeddedAddress: undefined,
    walletStatus: { status: 'idle' },
    chainType: initialChainType,
    isLoading: true,
    needsRecovery: false,
    recoveryError: null,

    setUser: (user) => {
      set({ user })
    },
    setLinkedAccounts: (linkedAccounts) => {
      set({ linkedAccounts })
    },
    setEmbeddedState: (embeddedState) => {
      set({ embeddedState })
    },
    setEmbeddedAccounts: (embeddedAccounts) => {
      set({ embeddedAccounts })
    },
    setIsLoadingAccounts: (isLoadingAccounts) => {
      set({ isLoadingAccounts })
    },
    setActiveEmbeddedAddress: (activeEmbeddedAddress) => {
      set({ activeEmbeddedAddress })
    },
    setWalletStatus: (walletStatus) => {
      set({ walletStatus })
    },
    setRecoveryError: (recoveryError) => {
      set({ recoveryError })
    },
    setChainType: (chainType) => {
      set({ chainType })
    },
    recomputeIsLoading: () => {
      const state = store.getState()
      const info = getBridgeInfo?.() ?? { hasBridge: false, address: undefined }
      const loading = computeIsLoading(
        state.embeddedState,
        state.user,
        info.hasBridge,
        info.address,
        state.embeddedAccounts,
        state.activeEmbeddedAddress,
        connectOnLogin
      )
      if (loading !== state.isLoading) {
        set({ isLoading: loading })
      }
    },

    // Injected by CoreOpenfortProvider after mount (depend on bridge / external refs)
    logout: async () => {},
    signUpGuest: async () => {},
    updateUser: async () => null,
    updateEmbeddedAccounts: async () => undefined,
    client,
  }))

  // Recompute derived state when dependencies change
  store.subscribe((state, prev) => {
    const embeddedStateChanged = state.embeddedState !== prev.embeddedState
    const userChanged = state.user !== prev.user
    const embeddedAccountsChanged = state.embeddedAccounts !== prev.embeddedAccounts
    const activeAddressChanged = state.activeEmbeddedAddress !== prev.activeEmbeddedAddress

    if (embeddedStateChanged || userChanged || embeddedAccountsChanged || activeAddressChanged) {
      const info = getBridgeInfo?.() ?? { hasBridge: false, address: undefined }
      const isLoading = computeIsLoading(
        state.embeddedState,
        state.user,
        info.hasBridge,
        info.address,
        state.embeddedAccounts,
        state.activeEmbeddedAddress,
        connectOnLogin
      )
      if (isLoading !== state.isLoading) {
        store.setState({ isLoading })
      }
    }

    if (embeddedStateChanged || embeddedAccountsChanged) {
      const needsRecovery = computeNeedsRecovery(state.embeddedState, state.embeddedAccounts)
      if (needsRecovery !== state.needsRecovery) {
        store.setState({ needsRecovery })
      }
    }

    // Clear recoveryError when the session reaches a clean terminal state.
    // Avoids stale errors from a previous recovery attempt being visible after
    // the user has successfully recovered or logged out.
    if (embeddedStateChanged && state.recoveryError !== null) {
      const isClearState =
        state.embeddedState === EmbeddedState.READY || state.embeddedState === EmbeddedState.UNAUTHENTICATED
      if (isClearState) {
        store.setState({ recoveryError: null })
      }
    }
  })

  return store
}
