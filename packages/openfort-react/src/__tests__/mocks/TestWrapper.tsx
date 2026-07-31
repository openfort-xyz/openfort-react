import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type PropsWithChildren } from 'react'
import type { OpenfortCoreContextValue } from '../../openfort/CoreOpenfortProvider.js'
import { StoreContext } from '../../openfort/context.js'
import { createOpenfortStore } from '../../openfort/store.js'
import { createMockOpenfortClient } from './openfortClient.js'

/**
 * Builds default OpenfortCoreContextValue fields for tests.
 * Use in tests to provide only the values your test cares about.
 */
export function buildContextValue(overrides: Partial<OpenfortCoreContextValue> = {}): OpenfortCoreContextValue {
  const mockClient = createMockOpenfortClient()

  return {
    chainType: ChainTypeEnum.EVM,
    setChainType: () => {},
    signUpGuest: async () => {},
    embeddedState: EmbeddedState.NONE,
    isLoading: false,
    needsRecovery: false,
    user: null,
    updateUser: async () => null,
    linkedAccounts: [],
    embeddedAccounts: undefined,
    isLoadingAccounts: false,
    activeEmbeddedAddress: undefined,
    setActiveEmbeddedAddress: () => {},
    logout: async () => {},
    updateEmbeddedAccounts: async () => undefined,
    walletStatus: { status: 'idle' },
    setWalletStatus: () => {},
    setUser: () => {},
    setLinkedAccounts: () => {},
    setEmbeddedState: () => {},
    setEmbeddedAccounts: () => {},
    setIsLoadingAccounts: () => {},
    client: mockClient as unknown as OpenfortCoreContextValue['client'],
    ...overrides,
  }
}

/**
 * Creates a Zustand store pre-populated with test state.
 */
function createTestStore(overrides: Partial<OpenfortCoreContextValue> = {}) {
  const defaults = buildContextValue(overrides)
  const store = createOpenfortStore(defaults.chainType, defaults.client)
  const s = store.getState()
  s.setUser(defaults.user)
  s.setLinkedAccounts(defaults.linkedAccounts)
  s.setEmbeddedState(defaults.embeddedState)
  s.setEmbeddedAccounts(defaults.embeddedAccounts)
  s.setIsLoadingAccounts(defaults.isLoadingAccounts)
  s.setActiveEmbeddedAddress(defaults.activeEmbeddedAddress)
  s.setWalletStatus(defaults.walletStatus)
  // Inject functions that depend on bridge / external refs
  store.setState({
    logout: defaults.logout,
    signUpGuest: defaults.signUpGuest,
    updateUser: defaults.updateUser,
    updateEmbeddedAccounts: defaults.updateEmbeddedAccounts,
    setChainType: defaults.setChainType,
    client: defaults.client,
  })
  return store
}

/**
 * Test wrapper that provides StoreContext.
 * Usage: `renderHook(useUser, { wrapper: createStoreWrapper({ user: mockUser }) })`
 */
export function createStoreWrapper(overrides: Partial<OpenfortCoreContextValue> = {}) {
  const store = createTestStore(overrides)
  return function TestCoreWrapper({ children }: PropsWithChildren) {
    return createElement(StoreContext.Provider, { value: store }, children)
  }
}

/**
 * Test wrapper that provides a QueryClient which never retries and keeps no
 * cache between renders, so each test starts from a cold query state.
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function TestQueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}
