import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../shared/utils/embeddedSignerOperationQueue.js'

const SIGNATURE = `0x${'11'.repeat(64)}1b`
const ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'

const h = vi.hoisted(() => {
  const signMessage = vi.fn()
  const providerRequest = vi.fn()
  const getEthereumProvider = vi.fn(async () => ({ request: providerRequest }))
  return {
    signMessage,
    providerRequest,
    getEthereumProvider,
    activeEmbeddedAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    client: { embeddedWallet: { signMessage, getEthereumProvider } } as {
      embeddedWallet: { signMessage: typeof signMessage; getEthereumProvider: typeof getEthereumProvider }
    } | null,
  }
})

vi.mock('../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { client: typeof h.client; activeEmbeddedAddress: string }) => unknown) =>
    selector({ client: h.client, activeEmbeddedAddress: h.activeEmbeddedAddress }),
}))

const { use7702Authorization } = await import('../hooks/openfort/use7702Authorization.js')

describe('use7702Authorization signer serialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.activeEmbeddedAddress = ADDRESS
    h.client = { embeddedWallet: { signMessage: h.signMessage, getEthereumProvider: h.getEthereumProvider } }
    h.providerRequest.mockResolvedValue([ADDRESS])
    h.signMessage.mockResolvedValue(SIGNATURE)
  })

  it('waits for an earlier signer operation before signing an authorization', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    const { result } = renderHook(() => use7702Authorization())
    let authorizationRequest!: ReturnType<typeof result.current.signAuthorization>

    act(() => {
      authorizationRequest = result.current.signAuthorization({
        contractAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        nonce: 1,
      })
    })

    expect(h.signMessage).not.toHaveBeenCalled()
    release()
    await blocker
    await expect(authorizationRequest).resolves.toMatchObject({
      authorization: {
        address: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        nonce: 1,
      },
    })
    expect(h.signMessage).toHaveBeenCalledOnce()
  })

  it('keeps signAuthorization stable when hook options are omitted', () => {
    const { result, rerender } = renderHook(() => use7702Authorization())
    const initialSignAuthorization = result.current.signAuthorization
    const initialReset = result.current.reset

    rerender()

    expect(result.current.signAuthorization).toBe(initialSignAuthorization)
    expect(result.current.reset).toBe(initialReset)
  })

  it('uses the latest hook callback for a new request and retains it while that request is pending', async () => {
    let resolveSignature!: (signature: string) => void
    h.signMessage.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveSignature = resolve
        })
    )
    const firstOnSuccess = vi.fn()
    const latestOnSuccess = vi.fn()
    const { result, rerender } = renderHook(({ onSuccess }) => use7702Authorization({ onSuccess }), {
      initialProps: { onSuccess: firstOnSuccess },
    })
    const initialSignAuthorization = result.current.signAuthorization

    rerender({ onSuccess: latestOnSuccess })
    expect(result.current.signAuthorization).toBe(initialSignAuthorization)

    let authorizationRequest!: ReturnType<typeof result.current.signAuthorization>
    act(() => {
      authorizationRequest = result.current.signAuthorization({
        contractAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        nonce: 1,
      })
    })
    await vi.waitFor(() => expect(h.signMessage).toHaveBeenCalledOnce())
    rerender({ onSuccess: firstOnSuccess })

    await act(async () => {
      resolveSignature(SIGNATURE)
      await expect(authorizationRequest).resolves.toMatchObject({ status: 'success' })
    })
    expect(latestOnSuccess).toHaveBeenCalledOnce()
    expect(firstOnSuccess).not.toHaveBeenCalled()
  })

  it('lets only the latest overlapping request settle exposed state', async () => {
    let resolveFirstSignature!: (signature: string) => void
    let rejectSecondSignature!: (error: Error) => void
    h.signMessage
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstSignature = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectSecondSignature = reject
          })
      )
    const hookOnSuccess = vi.fn()
    const firstOnSuccess = vi.fn()
    const secondOnError = vi.fn()
    const { result } = renderHook(() => use7702Authorization({ onSuccess: hookOnSuccess }))
    let firstRequest!: ReturnType<typeof result.current.signAuthorization>
    let secondRequest!: ReturnType<typeof result.current.signAuthorization>

    act(() => {
      firstRequest = result.current.signAuthorization(
        {
          contractAddress: '0x1111111111111111111111111111111111111111',
          chainId: 8453,
          nonce: 1,
        },
        { onSuccess: firstOnSuccess }
      )
    })
    await vi.waitFor(() => expect(h.signMessage).toHaveBeenCalledOnce())

    act(() => {
      secondRequest = result.current.signAuthorization(
        {
          contractAddress: '0x2222222222222222222222222222222222222222',
          chainId: 8453,
          nonce: 2,
        },
        { onError: secondOnError }
      )
    })

    await act(async () => {
      resolveFirstSignature(SIGNATURE)
      await expect(firstRequest).resolves.toMatchObject({
        status: 'success',
        authorization: { address: '0x1111111111111111111111111111111111111111' },
      })
    })
    await vi.waitFor(() => expect(h.signMessage).toHaveBeenCalledTimes(2))

    expect(result.current).toMatchObject({
      data: null,
      isError: false,
      isLoading: true,
      isSuccess: false,
      error: undefined,
    })
    expect(hookOnSuccess).toHaveBeenCalledOnce()
    expect(firstOnSuccess).toHaveBeenCalledOnce()

    await act(async () => {
      rejectSecondSignature(new Error('latest signer unavailable'))
      await expect(secondRequest).resolves.toMatchObject({
        status: 'error',
        error: { name: 'WalletError', details: 'latest signer unavailable' },
      })
    })

    expect(result.current).toMatchObject({
      data: null,
      isError: true,
      isLoading: false,
      isSuccess: false,
      error: { name: 'WalletError', details: 'latest signer unavailable' },
    })
    expect(secondOnError).toHaveBeenCalledOnce()
  })

  it('does not sign when the active provider account changes during the queue wait', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(h.client as never, () => gate)
    const { result } = renderHook(() => use7702Authorization())
    const authorizationRequest = result.current.signAuthorization({
      contractAddress: '0x1111111111111111111111111111111111111111',
      chainId: 8453,
      nonce: 1,
    })

    h.providerRequest.mockResolvedValue([OTHER_ADDRESS])
    release()
    await blocker

    await expect(authorizationRequest).resolves.toMatchObject({
      error: { name: 'WalletNotConnectedError' },
    })
    expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' })
    expect(h.signMessage).not.toHaveBeenCalled()
  })

  it('does not sign when provider verification crosses an auth boundary', async () => {
    let resolveAccounts!: (accounts: string[]) => void
    h.providerRequest.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveAccounts = resolve
      })
    )
    const { result } = renderHook(() => use7702Authorization())
    const authorizationRequest = result.current.signAuthorization({
      contractAddress: '0x1111111111111111111111111111111111111111',
      chainId: 8453,
      nonce: 1,
    })
    await vi.waitFor(() => expect(h.providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' }))

    invalidateEmbeddedSignerOperations(h.client as never)
    resolveAccounts([ADDRESS])

    await expect(authorizationRequest).resolves.toMatchObject({
      error: { name: 'WalletNotConnectedError' },
    })
    expect(h.signMessage).not.toHaveBeenCalled()
  })

  it('resolves validation failures and reports error state and callbacks', async () => {
    const hookOnError = vi.fn()
    const callOnError = vi.fn()
    const { result } = renderHook(() => use7702Authorization({ onError: hookOnError }))

    let authorizationResult: Awaited<ReturnType<typeof result.current.signAuthorization>> | undefined
    await act(async () => {
      authorizationResult = await result.current.signAuthorization({ chainId: 8453, nonce: 1 } as never, {
        onError: callOnError,
      })
    })

    expect(authorizationResult).toMatchObject({ error: { name: 'MissingParameterError' } })
    expect(result.current).toMatchObject({
      data: null,
      isError: true,
      isLoading: false,
      isSuccess: false,
      error: { name: 'MissingParameterError' },
    })
    expect(hookOnError).toHaveBeenCalledWith(expect.objectContaining({ name: 'MissingParameterError' }))
    expect(callOnError).toHaveBeenCalledWith(expect.objectContaining({ name: 'MissingParameterError' }))
    expect(h.signMessage).not.toHaveBeenCalled()
  })

  it('resolves a typed initialization error when the client is unavailable', async () => {
    h.client = null
    const { result } = renderHook(() => use7702Authorization())

    await expect(
      result.current.signAuthorization({
        contractAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        nonce: 1,
      })
    ).resolves.toMatchObject({ error: { name: 'ClientNotInitializedError' } })
    expect(h.signMessage).not.toHaveBeenCalled()
  })

  it('wraps an unclassified signing failure in a typed wallet error', async () => {
    h.signMessage.mockRejectedValue(new Error('signer unavailable'))
    const { result } = renderHook(() => use7702Authorization())

    await expect(
      result.current.signAuthorization({
        contractAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        nonce: 1,
      })
    ).resolves.toMatchObject({
      error: { name: 'WalletError', details: 'signer unavailable' },
    })
  })

  it('reports success through state and hook-level and per-call callbacks', async () => {
    const hookOnSuccess = vi.fn()
    const callOnSuccess = vi.fn()
    const { result } = renderHook(() => use7702Authorization({ onSuccess: hookOnSuccess }))

    let authorizationResult: Awaited<ReturnType<typeof result.current.signAuthorization>> | undefined
    await act(async () => {
      authorizationResult = await result.current.signAuthorization(
        {
          contractAddress: '0x1111111111111111111111111111111111111111',
          chainId: 8453,
          nonce: 1,
        },
        { hashMessage: true, arrayifyMessage: true, onSuccess: callOnSuccess }
      )
    })

    expect(authorizationResult).toMatchObject({
      authorization: { address: '0x1111111111111111111111111111111111111111' },
    })
    expect(result.current).toMatchObject({
      data: { address: '0x1111111111111111111111111111111111111111' },
      isError: false,
      isLoading: false,
      isSuccess: true,
    })
    expect(h.signMessage).toHaveBeenCalledWith(expect.any(String), {
      hashMessage: true,
      arrayifyMessage: true,
    })
    expect(hookOnSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ authorization: expect.objectContaining({ chainId: 8453 }) })
    )
    expect(callOnSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ authorization: expect.objectContaining({ chainId: 8453 }) })
    )
  })
})
