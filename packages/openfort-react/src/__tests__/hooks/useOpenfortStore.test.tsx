import type { Openfort } from '@openfort/openfort-js'
import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreContext } from '../../openfort/context'
import {
  selectActiveAddress,
  selectChainType,
  selectEmbeddedState,
  selectIsAuthenticated,
  selectIsLoading,
  selectUser,
  selectWalletStatus,
} from '../../openfort/selectors'
import { createOpenfortStore } from '../../openfort/store'
import { useOpenfortStore } from '../../openfort/useOpenfortStore'
import { createMockOpenfortClient } from '../mocks/openfortClient'

function createStoreWrapper(overrides?: { chainType?: ChainTypeEnum }) {
  const store = createOpenfortStore(
    overrides?.chainType ?? ChainTypeEnum.EVM,
    createMockOpenfortClient() as unknown as Openfort
  )
  function Wrapper({ children }: PropsWithChildren) {
    return createElement(StoreContext.Provider, { value: store }, children)
  }
  return { Wrapper, store }
}

describe('useOpenfortStore', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useOpenfortStore((s) => s.user))
    }).toThrow('useOpenfortStore must be inside CoreOpenfortProvider.')
  })

  it('reads initial state', () => {
    const { Wrapper } = createStoreWrapper()
    const { result } = renderHook(() => useOpenfortStore((s) => s.user), { wrapper: Wrapper })
    expect(result.current).toBeNull()
  })

  it('re-renders on selected state change', () => {
    const { Wrapper, store } = createStoreWrapper()
    const { result } = renderHook(() => useOpenfortStore(selectEmbeddedState), { wrapper: Wrapper })

    expect(result.current).toBe(EmbeddedState.NONE)

    act(() => {
      store.getState().setEmbeddedState(EmbeddedState.READY)
    })

    expect(result.current).toBe(EmbeddedState.READY)
  })

  it('does not re-render when unrelated state changes', () => {
    const { Wrapper, store } = createStoreWrapper()
    let renderCount = 0
    const { result } = renderHook(
      () => {
        renderCount++
        return useOpenfortStore(selectEmbeddedState)
      },
      { wrapper: Wrapper }
    )

    const initialRenderCount = renderCount

    // Change user — should NOT re-render since we only select embeddedState
    act(() => {
      store.getState().setUser({ id: 'usr_test' } as any)
    })

    expect(renderCount).toBe(initialRenderCount)
    expect(result.current).toBe(EmbeddedState.NONE)
  })

  it('selectors work correctly', () => {
    const { Wrapper, store } = createStoreWrapper()

    act(() => {
      store.getState().setUser({ id: 'usr_1' } as any)
      store.getState().setEmbeddedState(EmbeddedState.READY)
      store.getState().setActiveEmbeddedAddress('0x123')
      store.getState().setWalletStatus({ status: 'loading' })
    })

    const { result: user } = renderHook(() => useOpenfortStore(selectUser), { wrapper: Wrapper })
    expect(user.current).toEqual({ id: 'usr_1' })

    const { result: embState } = renderHook(() => useOpenfortStore(selectEmbeddedState), { wrapper: Wrapper })
    expect(embState.current).toBe(EmbeddedState.READY)

    const { result: isAuth } = renderHook(() => useOpenfortStore(selectIsAuthenticated), { wrapper: Wrapper })
    expect(isAuth.current).toBe(true)

    const { result: addr } = renderHook(() => useOpenfortStore(selectActiveAddress), { wrapper: Wrapper })
    expect(addr.current).toBe('0x123')

    const { result: walletStatus } = renderHook(() => useOpenfortStore(selectWalletStatus), { wrapper: Wrapper })
    expect(walletStatus.current).toEqual({ status: 'loading' })

    const { result: chain } = renderHook(() => useOpenfortStore(selectChainType), { wrapper: Wrapper })
    expect(chain.current).toBe(ChainTypeEnum.EVM)

    const { result: loading } = renderHook(() => useOpenfortStore(selectIsLoading), { wrapper: Wrapper })
    // READY + user set = not loading
    expect(loading.current).toBe(false)
  })

  it('derived isLoading computes correctly', () => {
    const { Wrapper, store } = createStoreWrapper()

    // NONE → isLoading = true
    const { result } = renderHook(() => useOpenfortStore(selectIsLoading), { wrapper: Wrapper })
    expect(result.current).toBe(true)

    // UNAUTHENTICATED + no user → isLoading = false
    act(() => {
      store.getState().setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    expect(result.current).toBe(false)

    // EMBEDDED_SIGNER_NOT_CONFIGURED + no user → isLoading = true
    act(() => {
      store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    })
    expect(result.current).toBe(true)

    // EMBEDDED_SIGNER_NOT_CONFIGURED + user → isLoading = false
    act(() => {
      store.getState().setUser({ id: 'usr_1' } as any)
    })
    expect(result.current).toBe(false)
  })

  it('derived needsRecovery computes correctly', () => {
    const { Wrapper, store } = createStoreWrapper()

    const { result } = renderHook(() => useOpenfortStore((s) => s.needsRecovery), { wrapper: Wrapper })
    expect(result.current).toBe(false)

    // EMBEDDED_SIGNER_NOT_CONFIGURED + accounts → needsRecovery = true
    act(() => {
      store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
      store.getState().setEmbeddedAccounts([{ id: 'acc_1', address: '0x1' } as any])
    })
    expect(result.current).toBe(true)

    // READY → needsRecovery = false
    act(() => {
      store.getState().setEmbeddedState(EmbeddedState.READY)
    })
    expect(result.current).toBe(false)
  })
})
