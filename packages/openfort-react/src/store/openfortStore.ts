import type { EmbeddedAccount, EmbeddedState, Openfort, User } from '@openfort/openfort-js'
import type { QueryObserverResult, RefetchOptions } from '@tanstack/react-query'
import { createStore } from 'zustand/vanilla'
import type { WalletFlowStatus } from '../hooks/openfort/useWallets'
import type { UserAccount } from '../openfortCustomTypes'

// ---------------------------------------------------------------------------
// State & Actions types
// ---------------------------------------------------------------------------

export type OpenfortStoreState = {
  // Core authentication state
  user: User | null
  linkedAccounts: UserAccount[]
  embeddedState: EmbeddedState
  isConnectedWithEmbeddedSigner: boolean

  // Wallet state
  walletStatus: WalletFlowStatus
  embeddedAccounts: EmbeddedAccount[] | undefined
  isLoadingAccounts: boolean

  // Imperative refs — set once by CoreOpenfortProvider
  client: Openfort | null
  updateUser: ((user?: User) => Promise<User | null>) | null
  updateEmbeddedAccounts: ((options?: RefetchOptions) => Promise<QueryObserverResult<EmbeddedAccount[], Error>>) | null
  logout: (() => void) | null
  signUpGuest: (() => Promise<void>) | null
}

export type OpenfortStoreActions = {
  setUser: (user: User | null) => void
  setLinkedAccounts: (accounts: UserAccount[]) => void
  setEmbeddedState: (state: EmbeddedState) => void
  setIsConnectedWithEmbeddedSigner: (connected: boolean) => void
  setWalletStatus: (status: WalletFlowStatus) => void
  setEmbeddedAccounts: (accounts: EmbeddedAccount[] | undefined) => void
  setIsLoadingAccounts: (loading: boolean) => void

  // Register imperative refs
  setClient: (client: Openfort) => void
  setUpdateUser: (fn: (user?: User) => Promise<User | null>) => void
  setUpdateEmbeddedAccounts: (
    fn: (options?: RefetchOptions) => Promise<QueryObserverResult<EmbeddedAccount[], Error>>
  ) => void
  setLogout: (fn: () => void) => void
  setSignUpGuest: (fn: () => Promise<void>) => void

  resetOnLogout: () => void
}

export type OpenfortStore = OpenfortStoreState & OpenfortStoreActions

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

// EmbeddedState.NONE = 0 — avoid importing the enum value at module level
// so the store file stays framework-agnostic. The provider sets the real value.
const EMBEDDED_STATE_NONE = 0 as EmbeddedState

const initialState: OpenfortStoreState = {
  user: null,
  linkedAccounts: [],
  embeddedState: EMBEDDED_STATE_NONE,
  isConnectedWithEmbeddedSigner: false,

  walletStatus: { status: 'idle' },
  embeddedAccounts: undefined,
  isLoadingAccounts: false,

  client: null,
  updateUser: null,
  updateEmbeddedAccounts: null,
  logout: null,
  signUpGuest: null,
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createOpenfortStore() {
  return createStore<OpenfortStore>()((set) => ({
    ...initialState,

    // State setters
    setUser: (user) => set({ user }),
    setLinkedAccounts: (linkedAccounts) => set({ linkedAccounts }),
    setEmbeddedState: (embeddedState) => set({ embeddedState }),
    setIsConnectedWithEmbeddedSigner: (isConnectedWithEmbeddedSigner) => set({ isConnectedWithEmbeddedSigner }),
    setWalletStatus: (walletStatus) => set({ walletStatus }),
    setEmbeddedAccounts: (embeddedAccounts) => set({ embeddedAccounts }),
    setIsLoadingAccounts: (isLoadingAccounts) => set({ isLoadingAccounts }),

    // Register imperative refs
    setClient: (client) => set({ client }),
    setUpdateUser: (updateUser) => set({ updateUser }),
    setUpdateEmbeddedAccounts: (updateEmbeddedAccounts) => set({ updateEmbeddedAccounts }),
    setLogout: (logout) => set({ logout }),
    setSignUpGuest: (signUpGuest) => set({ signUpGuest }),

    // Reset on logout (preserves client + ref functions)
    resetOnLogout: () =>
      set({
        user: null,
        linkedAccounts: [],
        isConnectedWithEmbeddedSigner: false,
        walletStatus: { status: 'idle' },
        embeddedAccounts: undefined,
        isLoadingAccounts: false,
      }),
  }))
}

export type OpenfortStoreApi = ReturnType<typeof createOpenfortStore>
