import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignRequest } from '../../components/Openfort/types.js'
import { routes } from '../../components/Openfort/types.js'

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state = {
    request: null as SignRequest | null,
    open: false,
    route: 'loading' as string,
  }
  const emit = () => {
    for (const listener of listeners) listener()
  }
  return {
    state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setOpen: vi.fn((open: boolean) => {
      state.open = open
      if (open) state.route = 'loading'
      emit()
    }),
    setRoute: vi.fn((route: string | { route: string }) => {
      state.route = typeof route === 'string' ? route : route.route
      emit()
    }),
    setSignRequest: vi.fn((next: SignRequest | null | ((current: SignRequest | null) => SignRequest | null)) => {
      state.request = typeof next === 'function' ? next(state.request) : next
      emit()
    }),
  }
})

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfortSignRequest: () => {
    const request = useSyncExternalStore(h.subscribe, () => h.state.request)
    return { signRequest: request, setSignRequest: h.setSignRequest }
  },
  useOpenfortRouting: () => {
    const snapshot = useSyncExternalStore(h.subscribe, () => `${h.state.open}:${h.state.route}`)
    const [open] = snapshot.split(':')
    return {
      open: open === 'true',
      route: { route: h.state.route },
      setOpen: h.setOpen,
      setRoute: h.setRoute,
      setConnector: vi.fn(),
      connector: { id: '' },
      chainType: ChainTypeEnum.EVM,
    }
  },
  useOpenfort: () => {
    const request = useSyncExternalStore(h.subscribe, () => h.state.request)
    return { signRequest: request, setSignRequest: h.setSignRequest }
  },
  useOpenfortForms: () => ({ setSendForm: vi.fn() }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      isLoading: false,
      user: { id: 'usr_test' },
      needsRecovery: false,
      embeddedAccounts: [],
      activeEmbeddedAddress: undefined,
      embeddedState: EmbeddedState.READY,
    }),
}))

vi.mock('../../core/ConnectionStrategyContext.js', () => ({
  useConnectionStrategy: () => ({ kind: 'embedded', isConnected: () => true }),
}))

vi.mock('../../ethereum/OpenfortEthereumBridgeContext.js', () => ({ useEthereumBridge: () => null }))

const { useSignMessage } = await import('../../hooks/openfort/useSignMessage.js')
const { useUI } = await import('../../hooks/openfort/useUI.js')

describe('useSignMessage lifecycle', () => {
  beforeEach(() => {
    h.state.request = null
    h.state.open = false
    h.state.route = routes.LOADING
    vi.clearAllMocks()
  })

  it('resolves a typed error and clears pending state when useUI routes away', async () => {
    const { result } = renderHook(() => ({ signer: useSignMessage(), ui: useUI() }))
    let signature!: ReturnType<typeof result.current.signer.signMessage>

    act(() => {
      signature = result.current.signer.signMessage('approve this request')
    })

    expect(result.current.signer.isPending).toBe(true)
    expect(h.state.route).toBe(routes.SIGN_MESSAGE)

    act(() => result.current.ui.openProfile())

    await expect(signature).resolves.toMatchObject({
      error: { name: 'WalletError', shortMessage: 'Signature request was cancelled.' },
    })
    await waitFor(() => expect(result.current.signer.isPending).toBe(false))
    expect(result.current.signer.error).toMatchObject({ name: 'WalletError' })
    expect(h.state.request).toBeNull()
    expect(h.state.route).toBe(routes.CONNECTED)
  })

  it('keeps pending true when an older request settles after a newer request starts', async () => {
    const { result } = renderHook(() => useSignMessage())
    let first!: ReturnType<typeof result.current.signMessage>
    let second!: ReturnType<typeof result.current.signMessage>

    act(() => {
      first = result.current.signMessage('first')
    })
    act(() => {
      second = result.current.signMessage('second')
    })

    await expect(first).resolves.toMatchObject({
      error: { name: 'WalletError', shortMessage: 'Signature request was superseded by a newer request.' },
    })
    expect(result.current.isPending).toBe(true)

    act(() => h.state.request?.settle({ signature: '0xsigned' }))
    await expect(second).resolves.toEqual({ signature: '0xsigned' })
    await waitFor(() => expect(result.current.isPending).toBe(false))
  })

  it('isolates callbacks while reporting success and cancellation', async () => {
    const onSuccess = vi.fn(() => {
      throw new Error('consumer success callback failed')
    })
    const onError = vi.fn(async () => {
      throw new Error('consumer error callback failed')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { result } = renderHook(() => ({ signer: useSignMessage({ onSuccess, onError }), ui: useUI() }))
      let success!: ReturnType<typeof result.current.signer.signMessage>
      act(() => {
        success = result.current.signer.signMessage('first')
      })
      act(() => h.state.request?.settle({ signature: '0xsigned' }))
      await expect(success).resolves.toEqual({ signature: '0xsigned' })
      expect(onSuccess).toHaveBeenCalledOnce()
      expect(onError).not.toHaveBeenCalled()

      let cancelled!: ReturnType<typeof result.current.signer.signMessage>
      act(() => {
        cancelled = result.current.signer.signMessage('second')
      })
      act(() => result.current.ui.close())
      await expect(cancelled).resolves.toMatchObject({ error: { name: 'WalletError' } })
      expect(onError).toHaveBeenCalledOnce()
      expect(onSuccess).toHaveBeenCalledOnce()
    } finally {
      consoleError.mockRestore()
    }
  })
})
