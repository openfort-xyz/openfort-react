import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { createElement, type PropsWithChildren } from 'react'
import type { OpenfortCoreContextValue } from '../../openfort/CoreOpenfortProvider'
import { StoreContext } from '../../openfort/context'
import { createOpenfortStore } from '../../openfort/store'
import { createMockOpenfortClient } from './openfortClient'

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
 * Usage: `renderHook(useUser, { wrapper: createTestWrapper({ user: mockUser }) })`
 */
export function createTestWrapper(overrides: Partial<OpenfortCoreContextValue> = {}) {
  const store = createTestStore(overrides)
  return function TestCoreWrapper({ children }: PropsWithChildren) {
    return createElement(StoreContext.Provider, { value: store }, children)
  }
}
