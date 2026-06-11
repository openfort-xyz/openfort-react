import type { Openfort } from '@openfort/openfort-js'
import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { createOpenfortStore } from '../../openfort/store'
import { createMockOpenfortClient } from '../mocks/openfortClient'

function makeStore(hasBridge = false, bridgeAddress?: string) {
  return createOpenfortStore(ChainTypeEnum.EVM, createMockOpenfortClient() as unknown as Openfort, () => ({
    hasBridge,
    address: bridgeAddress,
  }))
}

describe('store — computeIsLoading', () => {
  it('is true when state is NONE', () => {
    const store = makeStore()
    // Initial state is NONE → isLoading = true
    expect(store.getState().isLoading).toBe(true)
  })

  it('is true when state is CREATING_ACCOUNT', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.CREATING_ACCOUNT)
    expect(store.getState().isLoading).toBe(true)
  })

  it('is true when UNAUTHENTICATED but user is still set', () => {
    const store = makeStore()
    store.setState({ user: { id: 'u1' } as never })
    store.getState().setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    expect(store.getState().isLoading).toBe(true)
  })

  it('is false when UNAUTHENTICATED and no user', () => {
    const store = makeStore()
    // user is null by default
    store.getState().setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    expect(store.getState().isLoading).toBe(false)
  })

  it('is true when EMBEDDED_SIGNER_NOT_CONFIGURED and no user', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    expect(store.getState().isLoading).toBe(true)
  })

  it('is false when EMBEDDED_SIGNER_NOT_CONFIGURED and user is set', () => {
    const store = makeStore()
    store.setState({ user: { id: 'u1' } as never })
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    expect(store.getState().isLoading).toBe(false)
  })

  it('is false when READY with user and no bridge', () => {
    const store = makeStore(false)
    store.setState({ user: { id: 'u1' } as never })
    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().isLoading).toBe(false)
  })

  it('is true when READY with user but bridge has no address', () => {
    const store = makeStore(true, undefined)
    store.setState({ user: { id: 'u1' } as never })
    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().isLoading).toBe(true)
  })

  it('is false when READY with user and bridge has address', () => {
    const store = makeStore(true, '0xabc')
    store.setState({ user: { id: 'u1' } as never })
    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().isLoading).toBe(false)
  })

  it('is true when READY but no user', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().isLoading).toBe(true)
  })
})

describe('store — computeNeedsRecovery', () => {
  it('is false initially', () => {
    const store = makeStore()
    expect(store.getState().needsRecovery).toBe(false)
  })

  it('is true when EMBEDDED_SIGNER_NOT_CONFIGURED with accounts', () => {
    const store = makeStore()
    store.getState().setEmbeddedAccounts([{ id: 'a1', address: '0x1' } as never])
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    expect(store.getState().needsRecovery).toBe(true)
  })

  it('is false when EMBEDDED_SIGNER_NOT_CONFIGURED with no accounts', () => {
    const store = makeStore()
    store.getState().setEmbeddedAccounts([])
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    expect(store.getState().needsRecovery).toBe(false)
  })

  it('is false when READY even with accounts', () => {
    const store = makeStore()
    store.getState().setEmbeddedAccounts([{ id: 'a1', address: '0x1' } as never])
    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().needsRecovery).toBe(false)
  })
})

describe('store — recoveryError auto-clear', () => {
  it('clears recoveryError when state transitions to READY', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    store.getState().setRecoveryError(new Error('recover failed'))
    expect(store.getState().recoveryError).not.toBeNull()

    store.getState().setEmbeddedState(EmbeddedState.READY)
    expect(store.getState().recoveryError).toBeNull()
  })

  it('clears recoveryError when state transitions to UNAUTHENTICATED', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    store.getState().setRecoveryError(new Error('recover failed'))
    expect(store.getState().recoveryError).not.toBeNull()

    store.getState().setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    expect(store.getState().recoveryError).toBeNull()
  })

  it('does NOT clear recoveryError on non-terminal states', () => {
    const store = makeStore()
    store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    store.getState().setRecoveryError(new Error('recover failed'))

    store.getState().setEmbeddedState(EmbeddedState.NONE)
    expect(store.getState().recoveryError).not.toBeNull()
  })
})

describe('store — construction', () => {
  it('exposes client immediately at construction time', () => {
    const client = createMockOpenfortClient() as unknown as Openfort
    const store = createOpenfortStore(ChainTypeEnum.EVM, client)
    expect(store.getState().client).toBe(client)
  })

  it('default action no-ops resolve without throwing', async () => {
    const store = makeStore()
    await expect(store.getState().logout()).resolves.toBeUndefined()
    await expect(store.getState().signUpGuest()).resolves.toBeUndefined()
    await expect(store.getState().updateUser()).resolves.toBeNull()
    await expect(store.getState().updateEmbeddedAccounts()).resolves.toBeUndefined()
  })
})
