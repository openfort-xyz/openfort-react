import { ChainTypeEnum, EmbeddedState, type Openfort, OpenfortEvents } from '@openfort/openfort-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { createElement, useContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from 'zustand'
import { useAuthTransitions } from '../../openfort/authTransitionContext.js'
import { StoreContext } from '../../openfort/context.js'
import { getOpenfortQueryInputScope, getOpenfortQueryScope, openfortKeys } from '../../query/queryKeys.js'
import { getEmbeddedAccountsQueryOptions, getUserQueryOptions } from '../../query/queryOptions.js'
import {
  captureEmbeddedSignerSession,
  runEmbeddedSignerOperation,
} from '../../shared/utils/embeddedSignerOperationQueue.js'
import { createMockOpenfortClient, type MockOpenfortClient } from '../mocks/openfortClient.js'

let mockClient: MockOpenfortClient
const mockClientsByPublishableKey = new Map<string, MockOpenfortClient>()

// Mock the Openfort SDK constructor
vi.mock('../../openfort/core', () => ({
  createOpenfortClient: (config: { baseConfiguration: { publishableKey: string } }) =>
    mockClientsByPublishableKey.get(config.baseConfiguration.publishableKey) ?? mockClient,
  setDefaultClient: () => {},
}))

// Mock heavy dependencies to avoid importing the entire component tree
vi.mock('../../components/Openfort/useOpenfort', () => {
  const hook = () => ({
    walletConfig: undefined,
    chainType: ChainTypeEnum.EVM,
    setChainType: () => {},
    uiConfig: { walletConnectName: undefined },
    open: false,
    route: null,
    connector: null,
  })
  return { useOpenfort: hook, useOpenfortConfig: hook, useOpenfortRouting: hook }
})
vi.mock('../../wallets/useExternalConnectors', () => ({
  mapBridgeConnectorsToWalletProps: () => [],
}))
vi.mock('../../hooks/useConnectLifecycle', () => ({
  useConnectLifecycle: () => {},
}))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({
  OpenfortEthereumBridgeContext: { Provider: ({ children }: any) => children },
}))

const { CoreOpenfortProvider } = await import('../../openfort/CoreOpenfortProvider.js')

function StoreReaderInner({ store, onValue }: { store: any; onValue: (v: any) => void }) {
  const state = useStore(store)
  const authTransitions = useAuthTransitions()
  onValue({ ...state, ...authTransitions })
  return null
}

function StoreReader({ onValue }: { onValue: (v: any) => void }) {
  const store = useContext(StoreContext)
  if (!store) {
    onValue(null)
    return null
  }
  return createElement(StoreReaderInner, { store, onValue })
}

describe('CoreOpenfortProvider', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockClient = createMockOpenfortClient()
    mockClientsByPublishableKey.clear()
    // Suppress React act() warnings caused by async provider effects (user polling, account fetching)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('was not wrapped in act')) return
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    mockClient._test.reset()
  })

  const openfortConfig = {
    baseConfiguration: { publishableKey: 'pk_test_123' },
  }

  it('calls watchEmbeddedState on mount', async () => {
    await act(async () => {
      render(createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div')))
    })

    expect(mockClient.embeddedWallet.watchEmbeddedState).toHaveBeenCalledOnce()
    expect(mockClient.embeddedWallet.watchEmbeddedState).toHaveBeenCalledWith({
      onChange: expect.any(Function),
      onError: expect.any(Function),
    })
  })

  it('calls unwatch on unmount', async () => {
    let unmount: () => void
    await act(async () => {
      const result = render(createElement(CoreOpenfortProvider, { openfortConfig }, createElement('div')))
      unmount = result.unmount
    })

    expect(mockClient._test.unwatchFn).not.toHaveBeenCalled()

    unmount!()

    expect(mockClient._test.unwatchFn).toHaveBeenCalledOnce()
    expect(mockClient.eventEmitter.off).toHaveBeenCalledWith(
      OpenfortEvents.ON_EMBEDDED_WALLET_CONNECTION_LOST,
      expect.any(Function)
    )
  })

  it('provides embeddedState via store', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue).not.toBeNull()
    expect(storeValue.embeddedState).toBe(EmbeddedState.NONE)
  })

  it('updates store when watchEmbeddedState emits a state change', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.NONE)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.UNAUTHENTICATED)
  })

  it('requires signer recovery when the embedded iframe reloads', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
      mockClient._test.emitConnectionLost('iframe-reloaded')
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
  })

  it('keeps signer state for recoverable transport timeouts', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
      mockClient._test.emitConnectionLost('rpc-timeout')
    })

    expect(storeValue.embeddedState).toBe(EmbeddedState.READY)
  })

  it('transitions through multiple states correctly', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.UNAUTHENTICATED)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)

    act(() => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })
    expect(storeValue.embeddedState).toBe(EmbeddedState.READY)
  })

  it('logout clears user and embedded accounts', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    await act(async () => {
      await storeValue.logout()
    })

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(storeValue.user).toBeNull()
    expect(storeValue.linkedAccounts).toEqual([])
    expect(storeValue.embeddedAccounts).toBeUndefined()
    expect(storeValue.activeEmbeddedAddress).toBeUndefined()
  })

  it('coalesces the SDK unauthenticated event emitted by logout but cleans up a later spontaneous event', async () => {
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    await act(async () => storeValue.logout())
    await vi.waitFor(() => expect(mockClient.auth.logout).toHaveBeenCalledOnce())
    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    expect(mockClient.auth.logout).toHaveBeenCalledOnce()

    await act(async () => {
      await storeValue.startAuthTransition(async () => undefined).result
    })
    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.READY)
    })
    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    await vi.waitFor(() => expect(mockClient.auth.logout).toHaveBeenCalledTimes(2))
    expect(storeValue.user).toBeNull()
    expect(storeValue.embeddedAccounts).toBeUndefined()
  })

  it('ignores a delayed unauthenticated event owned by a superseded explicit logout', async () => {
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    await act(async () => storeValue.logout())
    const login = storeValue.startAuthTransition(async () => undefined)
    await act(async () => {
      await login.result
      await storeValue.updateUser({ id: 'new-principal', linkedAccounts: [] })
    })
    expect(storeValue.user?.id).toBe('new-principal')

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(storeValue.user?.id).toBe('new-principal')
  })

  it('does not let a failed logout marker consume a later principal loss', async () => {
    const logoutError = new Error('logout transport failed')
    mockClient.auth.logout.mockRejectedValueOnce(logoutError)
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    await act(async () => {
      await expect(storeValue.logout()).rejects.toBe(logoutError)
    })
    const login = storeValue.startAuthTransition(async () => undefined)
    await act(async () => {
      await login.result
      await storeValue.updateUser({ id: 'new-principal', linkedAccounts: [] })
    })

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    await vi.waitFor(() => expect(mockClient.auth.logout).toHaveBeenCalledTimes(2))
    expect(storeValue.user).toBeNull()
  })

  it('keeps logout authoritative when an older credential transition completes later', async () => {
    let storeValue: any = null
    let releaseCredentials!: () => void
    const credentialsGate = new Promise<void>((resolve) => {
      releaseCredentials = resolve
    })
    const storeCredentials = vi.fn(async () => credentialsGate)

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const login = storeValue.startAuthTransition(storeCredentials)
    const publishLogin = (async () => {
      await login.result
      if (login.isCurrent()) await storeValue.updateUser({ id: 'stale-user', linkedAccounts: [] })
    })()
    await vi.waitFor(() => expect(storeCredentials).toHaveBeenCalledOnce())

    const logout = storeValue.logout()
    expect(login.isCurrent()).toBe(false)
    expect(mockClient.auth.logout).not.toHaveBeenCalled()

    await act(async () => {
      releaseCredentials()
      await Promise.all([publishLogin, logout])
    })

    expect(mockClient.auth.logout).toHaveBeenCalledOnce()
    expect(storeValue.user).toBeNull()
  })

  it('keeps an unauthenticated SDK state authoritative over a pending credential transition', async () => {
    let storeValue: any = null
    let releaseCredentials!: () => void
    const credentialsGate = new Promise<void>((resolve) => {
      releaseCredentials = resolve
    })
    const storeCredentials = vi.fn(async () => credentialsGate)

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const login = storeValue.startAuthTransition(storeCredentials)
    const publishLogin = (async () => {
      await login.result
      if (login.isCurrent()) await storeValue.updateUser({ id: 'stale-user', linkedAccounts: [] })
    })()
    await vi.waitFor(() => expect(storeCredentials).toHaveBeenCalledOnce())

    await act(async () => {
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })
    expect(login.isCurrent()).toBe(false)
    expect(mockClient.auth.logout).not.toHaveBeenCalled()

    await act(async () => {
      releaseCredentials()
      await publishLogin
    })
    await vi.waitFor(() => expect(mockClient.auth.logout).toHaveBeenCalledOnce())

    expect(storeValue.user).toBeNull()
    expect(storeValue.embeddedAccounts).toBeUndefined()
    expect(storeCredentials.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.auth.logout.mock.invocationCallOrder[0]!
    )
  })

  it('publishes only the latest user when credential transitions overlap', async () => {
    let storeValue: any = null
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstMutation = vi.fn(async () => {
      await firstGate
      return { id: 'first-user', linkedAccounts: [] }
    })
    const secondMutation = vi.fn(async () => ({ id: 'second-user', linkedAccounts: [] }))
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const first = storeValue.startAuthTransition(firstMutation)
    const finishFirst = (async () => {
      const user = await first.result
      if (!first.isCurrent()) return
      await storeValue.updateUser(user)
      if (first.isCurrent()) firstCallback(user)
    })()
    await vi.waitFor(() => expect(firstMutation).toHaveBeenCalledOnce())

    const second = storeValue.startAuthTransition(secondMutation)
    const finishSecond = (async () => {
      const user = await second.result
      if (!second.isCurrent()) return
      await storeValue.updateUser(user)
      if (second.isCurrent()) secondCallback(user)
    })()
    expect(first.isCurrent()).toBe(false)
    expect(secondMutation).not.toHaveBeenCalled()

    await act(async () => {
      releaseFirst()
      await Promise.all([finishFirst, finishSecond])
    })

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledOnce()
    expect(storeValue.user?.id).toBe('second-user')
  })

  it('rejects signer work reserved while credentials are changing', async () => {
    let storeValue: any = null
    let releaseCredentials!: () => void
    const credentialsGate = new Promise<void>((resolve) => {
      releaseCredentials = resolve
    })
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const transition = storeValue.startAuthTransition(() => credentialsGate)
    const signerMutation = vi.fn(async () => undefined)
    const signerWork = runEmbeddedSignerOperation(mockClient as unknown as Openfort, signerMutation)
    await Promise.resolve()
    expect(signerMutation).not.toHaveBeenCalled()

    await act(async () => {
      releaseCredentials()
      await transition.result
    })

    await expect(signerWork).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    expect(signerMutation).not.toHaveBeenCalled()
  })

  it('cancels signer operations that were queued before logout', async () => {
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstStarted = vi.fn()
    const first = runEmbeddedSignerOperation(mockClient as unknown as Openfort, async () => {
      firstStarted()
      await firstGate
    })
    await vi.waitFor(() => expect(firstStarted).toHaveBeenCalledOnce())
    const queuedOperation = vi.fn(async () => undefined)
    const queued = runEmbeddedSignerOperation(mockClient as unknown as Openfort, queuedOperation)

    await act(async () => storeValue.logout())
    releaseFirst()
    await expect(first).rejects.toMatchObject({
      name: 'WalletNotConnectedError',
      shortMessage: 'The wallet session changed before the operation could finish.',
    })

    await expect(queued).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    expect(queuedOperation).not.toHaveBeenCalled()
  })

  it('invalidates captured, running, and queued signer work when the authenticated principal changes', async () => {
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })
    await act(async () => storeValue.updateUser({ id: 'principal-a', linkedAccounts: [] }))

    const capturedSession = captureEmbeddedSignerSession(mockClient as unknown as Openfort)
    let releaseRunning!: () => void
    const runningGate = new Promise<void>((resolve) => {
      releaseRunning = resolve
    })
    const staleCommit = vi.fn()
    const runningStarted = vi.fn()
    const running = runEmbeddedSignerOperation(mockClient as unknown as Openfort, async ({ assertCurrent }) => {
      runningStarted()
      await runningGate
      assertCurrent()
      staleCommit()
    })
    await vi.waitFor(() => expect(runningStarted).toHaveBeenCalledOnce())
    const queuedOperation = vi.fn(async () => undefined)
    const queued = runEmbeddedSignerOperation(mockClient as unknown as Openfort, queuedOperation)

    await act(async () => storeValue.updateUser({ id: 'principal-b', linkedAccounts: [] }))
    expect(() => capturedSession.assertCurrent()).toThrowError(
      expect.objectContaining({ name: 'WalletNotConnectedError' })
    )

    releaseRunning()
    await expect(running).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    await expect(queued).rejects.toMatchObject({ name: 'WalletNotConnectedError' })
    expect(staleCommit).not.toHaveBeenCalled()
    expect(queuedOperation).not.toHaveBeenCalled()
    expect(storeValue.user?.id).toBe('principal-b')
    expect(mockClient.auth.logout).not.toHaveBeenCalled()
  })

  it('evicts the previous principal embedded accounts query before publishing a new principal', async () => {
    const queryClient = new QueryClient()
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            CoreOpenfortProvider,
            { openfortConfig },
            createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
          )
        )
      )
    })

    await act(async () => storeValue.updateUser({ id: 'principal-a', linkedAccounts: [] }))
    const accountsKey = getEmbeddedAccountsQueryOptions(mockClient as unknown as Openfort).queryKey
    queryClient.setQueryData(accountsKey, [{ id: 'principal-a-account', address: '0x1' }])

    await act(async () => storeValue.updateUser({ id: 'principal-b', linkedAccounts: [] }))

    expect(storeValue.user?.id).toBe('principal-b')
    expect(storeValue.embeddedAccounts).toBeUndefined()
    expect(queryClient.getQueryData(accountsKey)).toBeUndefined()
  })

  it('clears authenticated state when the SDK becomes unauthenticated', async () => {
    const queryClient = new QueryClient()
    let storeValue: any = null
    await act(async () => {
      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            CoreOpenfortProvider,
            { openfortConfig },
            createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
          )
        )
      )
    })

    await act(async () => storeValue.updateUser({ id: 'departing-user', linkedAccounts: [{ id: 'linked' }] }))
    act(() => {
      storeValue.setEmbeddedAccounts([{ id: 'account', address: '0x1' }])
      storeValue.setActiveEmbeddedAddress('0x1')
      queryClient.setQueryData(getEmbeddedAccountsQueryOptions(mockClient as unknown as Openfort).queryKey, [
        { id: 'account', address: '0x1' },
      ])
      mockClient._test.setEmbeddedState(EmbeddedState.UNAUTHENTICATED)
    })

    expect(storeValue.user).toBeNull()
    expect(storeValue.linkedAccounts).toEqual([])
    expect(storeValue.embeddedAccounts).toBeUndefined()
    expect(storeValue.activeEmbeddedAddress).toBeUndefined()
    expect(queryClient.getQueryData(getUserQueryOptions(mockClient as unknown as Openfort).queryKey)).toBeUndefined()
    expect(
      queryClient.getQueryData(getEmbeddedAccountsQueryOptions(mockClient as unknown as Openfort).queryKey)
    ).toBeUndefined()
  })

  it('isolates concurrent providers that share a host QueryClient', async () => {
    const firstClient = createMockOpenfortClient()
    const secondClient = createMockOpenfortClient()
    firstClient.embeddedWallet.list.mockResolvedValue([{ id: 'first-account' }])
    secondClient.embeddedWallet.list.mockResolvedValue([{ id: 'second-account' }])
    mockClientsByPublishableKey.set('pk_test_first', firstClient)
    mockClientsByPublishableKey.set('pk_test_second', secondClient)
    const queryClient = new QueryClient()
    let firstStore: any = null
    let secondStore: any = null

    await act(async () => {
      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            'div',
            null,
            createElement(
              CoreOpenfortProvider,
              { openfortConfig: { baseConfiguration: { publishableKey: 'pk_test_first' } } },
              createElement(StoreReader, { onValue: (value: any) => (firstStore = value) })
            ),
            createElement(
              CoreOpenfortProvider,
              { openfortConfig: { baseConfiguration: { publishableKey: 'pk_test_second' } } },
              createElement(StoreReader, { onValue: (value: any) => (secondStore = value) })
            )
          )
        )
      )
    })

    await act(async () => {
      await firstStore.updateUser({ id: 'first-user', linkedAccounts: [] })
      await secondStore.updateUser({ id: 'second-user', linkedAccounts: [] })
      await firstStore.updateEmbeddedAccounts()
      await secondStore.updateEmbeddedAccounts()
    })

    const firstUserKey = getUserQueryOptions(firstClient as unknown as Openfort).queryKey
    const secondUserKey = getUserQueryOptions(secondClient as unknown as Openfort).queryKey
    const firstAccountsKey = getEmbeddedAccountsQueryOptions(firstClient as unknown as Openfort).queryKey
    const secondAccountsKey = getEmbeddedAccountsQueryOptions(secondClient as unknown as Openfort).queryKey
    const firstScope = getOpenfortQueryScope(firstClient as unknown as Openfort)
    const secondScope = getOpenfortQueryScope(secondClient as unknown as Openfort)
    const firstBalanceKey = openfortKeys.balance({
      address: '0xfirst',
      chainType: ChainTypeEnum.EVM,
      clientScope: firstScope,
      chainId: 8453,
      rpcUrl: 'https://first-rpc.example',
    })
    const secondBalanceKey = openfortKeys.balance({
      address: 'solana-second',
      chainType: ChainTypeEnum.SVM,
      clientScope: secondScope,
      cluster: 'devnet',
      commitment: 'confirmed',
      rpcUrl: 'https://second-rpc.example',
    })
    const firstAssetsKey = openfortKeys.walletAssets({
      address: '0xfirst',
      chainType: ChainTypeEnum.EVM,
      multiChain: false,
      clientScope: firstScope,
    })
    const secondAssetsKey = openfortKeys.walletAssets({
      address: 'solana-second',
      chainType: ChainTypeEnum.SVM,
      multiChain: false,
      clientScope: secondScope,
    })
    const rpcScope = getOpenfortQueryInputScope('https://fee-rpc.example')!
    const firstFeeKey = openfortKeys.solanaFee({
      clientScope: firstScope,
      address: 'solana-first',
      recipient: 'solana-recipient',
      rpcScope,
    })
    const secondFeeKey = openfortKeys.solanaFee({
      clientScope: secondScope,
      address: 'solana-second',
      recipient: 'solana-recipient',
      rpcScope,
    })
    queryClient.setQueryData(firstBalanceKey, 'first-balance')
    queryClient.setQueryData(secondBalanceKey, 'second-balance')
    queryClient.setQueryData(firstAssetsKey, 'first-assets')
    queryClient.setQueryData(secondAssetsKey, 'second-assets')
    queryClient.setQueryData(firstFeeKey, 'first-fee')
    queryClient.setQueryData(secondFeeKey, 'second-fee')
    expect(queryClient.getQueryData(firstUserKey)).toMatchObject({ id: 'first-user' })
    expect(queryClient.getQueryData(secondUserKey)).toMatchObject({ id: 'second-user' })
    expect(queryClient.getQueryData(firstAccountsKey)).toEqual([{ id: 'first-account' }])
    expect(queryClient.getQueryData(secondAccountsKey)).toEqual([{ id: 'second-account' }])

    await act(async () => secondStore.logout())

    expect(queryClient.getQueryData(firstUserKey)).toMatchObject({ id: 'first-user' })
    expect(queryClient.getQueryData(firstAccountsKey)).toEqual([{ id: 'first-account' }])
    expect(queryClient.getQueryData(secondUserKey)).toBeUndefined()
    expect(queryClient.getQueryData(secondAccountsKey)).toBeUndefined()
    expect(queryClient.getQueryData(firstBalanceKey)).toBe('first-balance')
    expect(queryClient.getQueryData(firstAssetsKey)).toBe('first-assets')
    expect(queryClient.getQueryData(firstFeeKey)).toBe('first-fee')
    expect(queryClient.getQueryData(secondBalanceKey)).toBeUndefined()
    expect(queryClient.getQueryData(secondAssetsKey)).toBeUndefined()
    expect(queryClient.getQueryData(secondFeeKey)).toBeUndefined()
  })

  it('does not expose a previous provider cache entry after remounting with a shared QueryClient', async () => {
    const queryClient = new QueryClient()
    const firstClient = createMockOpenfortClient()
    mockClient = firstClient
    let storeValue: any = null
    const renderProvider = () =>
      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            CoreOpenfortProvider,
            { openfortConfig },
            createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
          )
        )
      )

    let firstRender: ReturnType<typeof render>
    await act(async () => {
      firstRender = renderProvider()
    })
    await act(async () => storeValue.updateUser({ id: 'first-user', linkedAccounts: [] }))
    firstRender!.unmount()

    const secondClient = createMockOpenfortClient()
    mockClient = secondClient
    await act(async () => {
      renderProvider()
    })

    expect(queryClient.getQueryData(getUserQueryOptions(firstClient as unknown as Openfort).queryKey)).toMatchObject({
      id: 'first-user',
    })
    expect(queryClient.getQueryData(getUserQueryOptions(secondClient as unknown as Openfort).queryKey)).toBeUndefined()
  })

  it('does not restore user or accounts when requests resolve after logout', async () => {
    let storeValue: any = null
    let resolveUser!: (user: any) => void
    let resolveAccounts!: (accounts: any[]) => void
    mockClient.user.get.mockReturnValueOnce(new Promise((resolve) => (resolveUser = resolve)))
    mockClient.embeddedWallet.list.mockReturnValueOnce(new Promise((resolve) => (resolveAccounts = resolve)))

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const pendingUser = storeValue.updateUser()
    const pendingAccounts = storeValue.updateEmbeddedAccounts()
    await act(async () => storeValue.logout())
    await act(async () => {
      resolveUser({ id: 'old-user', linkedAccounts: [] })
      resolveAccounts([{ id: 'old-account' }])
      await Promise.all([pendingUser, pendingAccounts])
    })

    expect(storeValue.user).toBeNull()
    expect(storeValue.embeddedAccounts).toBeUndefined()
  })

  it('reuses an identical embedded-account request already in flight', async () => {
    let storeValue: any = null
    let resolveAccounts!: (accounts: any[]) => void
    mockClient.embeddedWallet.list.mockReturnValue(new Promise((resolve) => (resolveAccounts = resolve)))

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const first = storeValue.updateEmbeddedAccounts({ silent: true })
    const second = storeValue.updateEmbeddedAccounts({ silent: true })

    expect(mockClient.embeddedWallet.list).toHaveBeenCalledOnce()
    await act(async () => {
      resolveAccounts([{ id: 'embedded-account' }])
      await Promise.all([first, second])
    })
    expect(storeValue.embeddedAccounts).toEqual([{ id: 'embedded-account' }])
  })

  it('does not let an older user request replace a newer session user', async () => {
    let storeValue: any = null
    let resolveOldUser!: (user: any) => void
    mockClient.user.get.mockReturnValueOnce(new Promise((resolve) => (resolveOldUser = resolve)))

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, { onValue: (value: any) => (storeValue = value) })
        )
      )
    })

    const pendingOldUser = storeValue.updateUser()
    await act(async () => {
      await storeValue.updateUser({ id: 'new-user', linkedAccounts: [] })
      resolveOldUser({ id: 'old-user', linkedAccounts: [] })
      await pendingOldUser
    })

    expect(storeValue.user?.id).toBe('new-user')
  })

  it('store contains correct initial state and chainType', async () => {
    let storeValue: any = null

    await act(async () => {
      render(
        createElement(
          CoreOpenfortProvider,
          { openfortConfig },
          createElement(StoreReader, {
            onValue: (v: any) => {
              storeValue = v
            },
          })
        )
      )
    })

    expect(storeValue.user).toBeNull()
    expect(storeValue.chainType).toBe(ChainTypeEnum.EVM)
    expect(typeof storeValue.logout).toBe('function')
    expect(typeof storeValue.signUpGuest).toBe('function')
    expect(typeof storeValue.updateUser).toBe('function')
  })
})
