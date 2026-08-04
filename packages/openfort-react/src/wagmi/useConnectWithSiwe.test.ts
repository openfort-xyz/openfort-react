import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError } from '../errors/auth.js'

const h = vi.hoisted(() => {
  let generation = 0
  let tail = Promise.resolve()
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
    initSiwe: vi.fn(),
    invalidateSession,
    loginWithSiwe: vi.fn(),
    updateUser: vi.fn(),
    signMessage: vi.fn(),
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

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      client: { auth: { initSiwe: h.initSiwe, loginWithSiwe: h.loginWithSiwe } },
      user: null,
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
    account: {
      address: '0x1234567890123456789012345678901234567890',
      connector: { type: 'injected', id: 'mock' },
      chain: { id: 1, name: 'Ethereum' },
    },
    chainId: 1,
    signMessage: h.signMessage,
  }),
}))

vi.mock('../siwe/create-siwe-message', () => ({
  createSIWEMessage: () => 'siwe-message',
}))

const { useConnectWithSiwe } = await import('./useConnectWithSiwe.js')

describe('useConnectWithSiwe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.resetTransitions()
  })

  it('passes local typed errors to onError', async () => {
    const error = new AuthenticationError('nonce failed')
    h.initSiwe.mockRejectedValueOnce(error)
    const onError = vi.fn()
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(() => result.current.connectWithSiwe({ onError }))

    expect(onError).toHaveBeenCalledWith('Failed to connect with SIWE.', error)
  })

  it('keeps a successful login successful when onConnect throws synchronously', async () => {
    h.initSiwe.mockResolvedValueOnce({ nonce: 'nonce' })
    h.signMessage.mockResolvedValueOnce('0xsignature')
    h.loginWithSiwe.mockResolvedValueOnce(undefined)
    h.updateUser.mockResolvedValueOnce({ id: 'principal-b' })
    const onError = vi.fn()
    const onConnect = vi.fn(() => {
      throw new Error('consumer success callback failed')
    })
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(async () => {
      await expect(result.current.connectWithSiwe({ onConnect, onError })).resolves.toBeUndefined()
    })

    expect(onConnect).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.updateUser).toHaveBeenCalledOnce()
  })

  it('settles an early validation error when onError rejects asynchronously', async () => {
    const onConnect = vi.fn()
    const onError = vi.fn(async () => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(async () => {
      await expect(result.current.connectWithSiwe({ connectorType: '', onConnect, onError })).resolves.toBeUndefined()
      await Promise.resolve()
    })

    expect(onError).toHaveBeenCalledWith('No address found')
    expect(onConnect).not.toHaveBeenCalled()
    expect(h.initSiwe).not.toHaveBeenCalled()
  })

  it('does not reclassify a mapped auth error when onError throws synchronously', async () => {
    h.initSiwe.mockRejectedValueOnce(new Error('Invalid signature from provider'))
    const onConnect = vi.fn()
    const onError = vi.fn(() => {
      throw new Error('consumer error callback failed')
    })
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(async () => {
      await expect(result.current.connectWithSiwe({ onConnect, onError })).resolves.toBeUndefined()
    })

    expect(onError).toHaveBeenCalledWith('Invalid signature. Please try again.', undefined)
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('invalidates the previous principal before establishing SIWE credentials', async () => {
    h.initSiwe.mockResolvedValueOnce({ nonce: 'nonce' })
    h.signMessage.mockResolvedValueOnce('0xsignature')
    h.loginWithSiwe.mockResolvedValueOnce(undefined)
    h.updateUser.mockResolvedValueOnce({ id: 'principal-b' })
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(() => result.current.connectWithSiwe())

    expect(h.invalidateSession).toHaveBeenCalledOnce()
    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.invalidateSession.mock.invocationCallOrder[0]).toBeLessThan(h.loginWithSiwe.mock.invocationCallOrder[0]!)
    expect(h.updateUser).toHaveBeenCalledOnce()
  })

  it('does not establish credentials when logout supersedes a pending signature', async () => {
    const signature = deferred<string>()
    h.initSiwe.mockResolvedValueOnce({ nonce: 'nonce' })
    h.signMessage.mockReturnValueOnce(signature.promise)
    const onConnect = vi.fn()
    const { result } = renderHook(() => useConnectWithSiwe())

    let login!: ReturnType<typeof result.current.connectWithSiwe>
    act(() => {
      login = result.current.connectWithSiwe({ onConnect })
    })
    await waitFor(() => expect(h.signMessage).toHaveBeenCalledOnce())

    const logoutMutation = vi.fn(async () => undefined)
    const logout = h.startAuthTransition(logoutMutation)
    await act(async () => {
      signature.resolve('0xstale-signature')
      await Promise.all([login, logout.result])
    })

    expect(h.loginWithSiwe).not.toHaveBeenCalled()
    expect(h.updateUser).not.toHaveBeenCalled()
    expect(onConnect).not.toHaveBeenCalled()
    expect(logoutMutation).toHaveBeenCalledOnce()
  })

  it('lets only the newer overlapping attempt establish credentials and publish its callback', async () => {
    const firstSignature = deferred<string>()
    h.initSiwe.mockResolvedValueOnce({ nonce: 'first-nonce' }).mockResolvedValueOnce({ nonce: 'second-nonce' })
    h.signMessage.mockReturnValueOnce(firstSignature.promise).mockResolvedValueOnce('0xsecond-signature')
    h.loginWithSiwe.mockResolvedValue(undefined)
    h.updateUser.mockResolvedValue({ id: 'second-user' })
    const firstOnConnect = vi.fn()
    const secondOnConnect = vi.fn()
    const { result } = renderHook(() => useConnectWithSiwe())

    let first!: ReturnType<typeof result.current.connectWithSiwe>
    let second!: ReturnType<typeof result.current.connectWithSiwe>
    act(() => {
      first = result.current.connectWithSiwe({ onConnect: firstOnConnect })
    })
    await waitFor(() => expect(h.signMessage).toHaveBeenCalledOnce())
    act(() => {
      second = result.current.connectWithSiwe({ onConnect: secondOnConnect })
    })
    expect(h.initSiwe).toHaveBeenCalledOnce()

    await act(async () => {
      firstSignature.resolve('0xfirst-signature')
      await Promise.all([first, second])
    })

    expect(h.loginWithSiwe).toHaveBeenCalledOnce()
    expect(h.loginWithSiwe).toHaveBeenCalledWith(expect.objectContaining({ signature: '0xsecond-signature' }))
    expect(h.updateUser).toHaveBeenCalledOnce()
    expect(firstOnConnect).not.toHaveBeenCalled()
    expect(secondOnConnect).toHaveBeenCalledOnce()
  })
})
