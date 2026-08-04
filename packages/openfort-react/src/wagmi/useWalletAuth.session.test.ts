import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  let generation = 0
  let tail = Promise.resolve()
  let accountConnected = false
  const invalidateSession = vi.fn()
  const enqueue = <T>(mutation: () => Promise<T>) => {
    const result = tail.then(mutation)
    tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  return {
    connectAsync: vi.fn(),
    disconnect: vi.fn(),
    initSiwe: vi.fn(),
    invalidateSession,
    loginWithSiwe: vi.fn(),
    signMessage: vi.fn(),
    updateUser: vi.fn(),
    captureAuthSession: () => {
      const captured = generation
      return { isCurrent: () => generation === captured }
    },
    startAuthenticatedMutation: (mutation: () => Promise<unknown>) => {
      const captured = generation
      return { result: enqueue(mutation), isCurrent: () => generation === captured }
    },
    startAuthTransition: (mutation: () => Promise<unknown>) => {
      const captured = ++generation
      invalidateSession()
      return { result: enqueue(mutation), isCurrent: () => generation === captured }
    },
    resetTransitions: () => {
      generation = 0
      tail = Promise.resolve()
      accountConnected = false
    },
    isAccountConnected: () => accountConnected,
    setAccountConnected: (connected: boolean) => {
      accountConnected = connected
    },
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

const connectedAccount = {
  accounts: ['0x1234567890123456789012345678901234567890'],
  chainId: 1,
}

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      client: { auth: { initSiwe: h.initSiwe, loginWithSiwe: h.loginWithSiwe } },
      updateUser: h.updateUser,
    }),
}))

vi.mock('../openfort/authTransitionContext', () => ({
  useAuthTransitions: () => ({
    captureAuthSession: h.captureAuthSession,
    startAuthenticatedMutation: h.startAuthenticatedMutation,
    startAuthTransition: h.startAuthTransition,
  }),
}))

vi.mock('../ethereum/OpenfortEthereumBridgeContext', () => ({
  useEthereumBridge: () => ({
    account: { isConnected: h.isAccountConnected() },
    chainId: 1,
    connectAsync: h.connectAsync,
    connectors: [{ id: 'mock', name: 'Mock', type: 'injected' }],
    disconnect: h.disconnect,
    signMessage: h.signMessage,
  }),
}))

vi.mock('../siwe/create-siwe-message', () => ({
  createSIWEMessage: () => 'siwe-message',
}))

const { useWalletAuth } = await import('./useWalletAuth.js')

describe('useWalletAuth principal transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.resetTransitions()
    h.connectAsync.mockResolvedValue(connectedAccount)
    h.disconnect.mockResolvedValue(undefined)
    h.initSiwe.mockResolvedValue({ nonce: 'nonce' })
    h.signMessage.mockResolvedValue('0xsignature')
    h.loginWithSiwe.mockResolvedValue(undefined)
    h.updateUser.mockResolvedValue({ id: 'principal-b' })
  })

  it('invalidates the previous principal before establishing wallet SIWE credentials', async () => {
    const { result } = renderHook(() => useWalletAuth())

    await act(() => result.current.connectWallet('mock'))

    expect(h.invalidateSession).toHaveBeenCalledOnce()
    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.invalidateSession.mock.invocationCallOrder[0]).toBeLessThan(h.loginWithSiwe.mock.invocationCallOrder[0]!)
    expect(h.updateUser).toHaveBeenCalledOnce()
  })

  it('checks freshness before a same-tick stale attempt touches the bridge', async () => {
    const firstOnConnect = vi.fn()
    const secondOnConnect = vi.fn()
    const { result } = renderHook(() => useWalletAuth())

    let first!: ReturnType<typeof result.current.connectWallet>
    let second!: ReturnType<typeof result.current.connectWallet>
    act(() => {
      first = result.current.connectWallet('mock', { onConnect: firstOnConnect })
      second = result.current.connectWallet('mock', { onConnect: secondOnConnect })
    })
    await act(async () => {
      await Promise.all([first, second])
    })

    expect(h.connectAsync).toHaveBeenCalledOnce()
    expect(h.initSiwe).toHaveBeenCalledOnce()
    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.updateUser).toHaveBeenCalledOnce()
    expect(firstOnConnect).not.toHaveBeenCalled()
    expect(secondOnConnect).toHaveBeenCalledOnce()
  })

  it('keeps success settled when the custom onConnect rejects asynchronously', async () => {
    const hookOnSuccess = vi.fn()
    const hookOnError = vi.fn()
    const onConnect = vi.fn(async () => {
      throw new Error('consumer success callback failed')
    })
    const { result } = renderHook(() => useWalletAuth({ onSuccess: hookOnSuccess, onError: hookOnError }))

    await act(async () => {
      await expect(result.current.connectWallet('mock', { onConnect })).resolves.toBeUndefined()
      await Promise.resolve()
    })

    expect(result.current.isSuccess).toBe(true)
    expect(hookOnSuccess).toHaveBeenCalledOnce()
    expect(hookOnError).not.toHaveBeenCalled()
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('settles a missing-connector error when the custom onError throws synchronously', async () => {
    const hookOnSuccess = vi.fn()
    const hookOnError = vi.fn()
    const onError = vi.fn(() => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useWalletAuth({ onSuccess: hookOnSuccess, onError: hookOnError }))

    await act(async () => {
      await expect(result.current.connectWallet('missing', { onError })).resolves.toBeUndefined()
    })

    expect(result.current.isError).toBe(true)
    expect(hookOnError).toHaveBeenCalledOnce()
    expect(hookOnSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
    expect(h.connectAsync).not.toHaveBeenCalled()
  })

  it('settles a connect failure when the custom onError rejects asynchronously', async () => {
    h.connectAsync.mockRejectedValueOnce(new Error('bridge connection failed'))
    const hookOnError = vi.fn()
    const onError = vi.fn(async () => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useWalletAuth({ onError: hookOnError }))

    await act(async () => {
      await expect(result.current.connectWallet('mock', { onError })).resolves.toBeUndefined()
      await Promise.resolve()
    })

    expect(result.current.isError).toBe(true)
    expect(hookOnError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
    expect(h.initSiwe).not.toHaveBeenCalled()
  })

  it('settles a disconnect failure when the custom onError rejects asynchronously', async () => {
    h.setAccountConnected(true)
    h.disconnect.mockRejectedValueOnce(new Error('bridge disconnect failed'))
    const onError = vi.fn(async () => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useWalletAuth())

    await act(async () => {
      await expect(result.current.connectWallet('mock', { onError })).resolves.toBeUndefined()
      await Promise.resolve()
    })

    expect(result.current.isError).toBe(true)
    expect(onError).toHaveBeenCalledOnce()
    expect(h.connectAsync).not.toHaveBeenCalled()
  })

  it('does not reclassify a mapped SIWE error when the custom onError throws', async () => {
    h.initSiwe.mockRejectedValueOnce(new Error('Invalid signature returned'))
    const hookOnSuccess = vi.fn()
    const onError = vi.fn(() => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useWalletAuth({ onSuccess: hookOnSuccess }))

    await act(async () => {
      await expect(result.current.connectWallet('mock', { onError })).resolves.toBeUndefined()
    })

    expect(result.current.isError).toBe(true)
    expect(onError).toHaveBeenCalledWith('Invalid signature. Please try again.', expect.anything())
    expect(hookOnSuccess).not.toHaveBeenCalled()
  })

  it('does not establish credentials when logout supersedes a pending wallet connection', async () => {
    const connection = deferred<typeof connectedAccount>()
    h.connectAsync.mockReturnValueOnce(connection.promise)
    const onConnect = vi.fn()
    const { result } = renderHook(() => useWalletAuth())

    let login!: ReturnType<typeof result.current.connectWallet>
    act(() => {
      login = result.current.connectWallet('mock', { onConnect })
    })
    await waitFor(() => expect(h.connectAsync).toHaveBeenCalledOnce())

    const logoutMutation = vi.fn(async () => undefined)
    const logout = h.startAuthTransition(logoutMutation)
    await act(async () => {
      connection.resolve(connectedAccount)
      await Promise.all([login, logout.result])
    })

    expect(h.initSiwe).not.toHaveBeenCalled()
    expect(h.loginWithSiwe).not.toHaveBeenCalled()
    expect(h.updateUser).not.toHaveBeenCalled()
    expect(onConnect).not.toHaveBeenCalled()
    expect(logoutMutation).toHaveBeenCalledOnce()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.walletConnectingTo).toBeNull()
  })

  it('lets only the newer overlapping wallet attempt establish credentials and publish its callback', async () => {
    const firstConnection = deferred<typeof connectedAccount>()
    h.connectAsync.mockReturnValueOnce(firstConnection.promise).mockResolvedValueOnce(connectedAccount)
    h.initSiwe.mockResolvedValueOnce({ nonce: 'second-nonce' })
    h.signMessage.mockResolvedValueOnce('0xsecond-signature')
    const firstOnConnect = vi.fn()
    const secondOnConnect = vi.fn()
    const { result } = renderHook(() => useWalletAuth())

    let first!: ReturnType<typeof result.current.connectWallet>
    let second!: ReturnType<typeof result.current.connectWallet>
    act(() => {
      first = result.current.connectWallet('mock', { onConnect: firstOnConnect })
    })
    await waitFor(() => expect(h.connectAsync).toHaveBeenCalledOnce())
    act(() => {
      second = result.current.connectWallet('mock', { onConnect: secondOnConnect })
    })
    expect(h.connectAsync).toHaveBeenCalledOnce()

    await act(async () => {
      firstConnection.resolve(connectedAccount)
      await Promise.all([first, second])
    })

    expect(h.connectAsync).toHaveBeenCalledTimes(2)
    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.loginWithSiwe).toHaveBeenCalledWith(expect.objectContaining({ signature: '0xsecond-signature' }))
    expect(h.updateUser).toHaveBeenCalledOnce()
    expect(firstOnConnect).not.toHaveBeenCalled()
    expect(secondOnConnect).toHaveBeenCalledOnce()
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.walletConnectingTo).toBeNull()
  })
})
