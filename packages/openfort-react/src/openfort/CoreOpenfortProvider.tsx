'use client'

import {
  ChainTypeEnum,
  type EmbeddedAccount,
  EmbeddedState,
  type EmbeddedWalletConnectionLostPayload,
  type Openfort,
  OpenfortEvents,
  type User,
} from '@openfort/openfort-js'
import { useQueryClient } from '@tanstack/react-query'
import type React from 'react'
import {
  createElement,
  Fragment,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useStore } from 'zustand'
import { routes } from '../components/Openfort/types.js'
import { useOpenfortConfig, useOpenfortRouting } from '../components/Openfort/useOpenfort.js'
import { embeddedWalletId } from '../constants/openfort.js'
import type { ConnectionStrategy } from '../core/ConnectionStrategy.js'
import { ConnectionStrategyProvider, useConnectionStrategy } from '../core/ConnectionStrategyContext.js'
import { resolveEthereumFeeSponsorship } from '../core/strategyUtils.js'
import { OpenfortEthereumBridgeContext } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { useConnectLifecycle } from '../hooks/useConnectLifecycle.js'
import { QueryClientBoundary } from '../query/QueryClientBoundary.js'
import { getOpenfortQueryScope, openfortKeys } from '../query/queryKeys.js'
import { fetchEmbeddedAccounts as fetchEmbeddedAccountsFromApi, fetchUser } from '../query/queryOptions.js'
import type { AuthTransition } from '../shared/utils/authTransitionQueue.js'
import {
  captureAuthSession,
  reserveAuthenticatedMutation,
  reserveAuthTransition,
} from '../shared/utils/authTransitionQueue.js'
import {
  holdEmbeddedSignerOperationsDuringAuthTransition,
  invalidateEmbeddedSignerOperations,
  runEmbeddedSignerOperation,
} from '../shared/utils/embeddedSignerOperationQueue.js'
import { invalidatePersistentOperations } from '../shared/utils/persistentOperationRegistry.js'
import { showInitBanner } from '../utils/banner.js'
import { logger } from '../utils/logger.js'
import { handleOAuthConfigError } from '../utils/oauthErrorHandler.js'
import { mapBridgeConnectorsToWalletProps } from '../wallets/useExternalConnectors.js'
import { AuthTransitionContext, type AuthTransitionContextValue } from './authTransitionContext.js'
import type { ConnectCallbackProps } from './connectCallbackTypes.js'
import { StoreContext } from './context.js'
import { createOpenfortClient } from './core/index.js'
import { useActiveAddressSync } from './hooks/useActiveAddressSync.js'
import { useAutoRecovery } from './hooks/useAutoRecovery.js'
import { useEmbeddedStateMachine } from './hooks/useEmbeddedStateMachine.js'
import type { OpenfortStore } from './store.js'
import { createOpenfortStore } from './store.js'

/** Public return type for `useOpenfort()`. Matches the store shape. */
export type OpenfortCoreContextValue = OpenfortStore

function ConnectLifecycleEffect({ onConnect, onDisconnect }: ConnectCallbackProps) {
  const strategy = useConnectionStrategy()
  useConnectLifecycle(strategy, onConnect, onDisconnect)
  return null
}

type CoreOpenfortProviderProps = PropsWithChildren<
  {
    openfortConfig: ConstructorParameters<typeof Openfort>[0]
  } & ConnectCallbackProps
>

type ProviderInitKey = {
  kind: string
  chainType: ChainTypeEnum
  evmChainId: number | undefined
  feeSponsorshipPolicy: string | undefined
}

function isSameInitKey(left: ProviderInitKey | null, right: ProviderInitKey): boolean {
  return (
    left !== null &&
    left.kind === right.kind &&
    left.chainType === right.chainType &&
    left.evmChainId === right.evmChainId &&
    left.feeSponsorshipPolicy === right.feeSponsorshipPolicy
  )
}

function isAccountQueryOwnedByClient(queryKey: readonly unknown[], clientScope: string): boolean {
  if (
    queryKey[0] !== 'openfort' ||
    (queryKey[1] !== 'balance' &&
      queryKey[1] !== 'walletAssets' &&
      queryKey[1] !== 'erc20Balance' &&
      queryKey[1] !== 'transactionReceipt' &&
      queryKey[1] !== 'solanaFee' &&
      queryKey[1] !== 'gasEstimate')
  )
    return false
  const parameters = queryKey[2]
  return typeof parameters === 'object' && parameters !== null && 'clientScope' in parameters
    ? parameters.clientScope === clientScope
    : false
}

/**
 * Provides the Openfort store, client and connection strategy.
 *
 * Rendered under {@link QueryClientBoundary} so the SDK's queries always have a
 * `QueryClient`, whether or not the app supplies one.
 */
export const CoreOpenfortProvider: React.FC<CoreOpenfortProviderProps> = (props) =>
  createElement(QueryClientBoundary, null, createElement(CoreOpenfortProviderInner, props))

const CoreOpenfortProviderInner: React.FC<CoreOpenfortProviderProps> = ({
  children,
  onConnect,
  onDisconnect,
  openfortConfig,
}) => {
  const queryClient = useQueryClient()
  const bridge = useContext(OpenfortEthereumBridgeContext)
  const { walletConfig, uiConfig } = useOpenfortConfig()
  const { chainType, setChainType, open, route, connector } = useOpenfortRouting()

  const bridgeConnectors = useMemo(() => {
    if (!bridge) return []
    return mapBridgeConnectorsToWalletProps(bridge, {
      walletConnectName: uiConfig.walletConnectName,
    })
  }, [bridge, uiConfig.walletConnectName])

  const [solanaStrategy, setSolanaStrategy] = useState<ConnectionStrategy | null>(null)
  useEffect(() => {
    if (!walletConfig?.solana) {
      setSolanaStrategy(null)
      return
    }
    let cancelled = false
    import('../core/strategies/SolanaEmbeddedStrategy.js').then((m) => {
      if (!cancelled) setSolanaStrategy(m.createSolanaEmbeddedStrategy(walletConfig))
    })
    return () => {
      cancelled = true
    }
  }, [walletConfig])

  const [evmStrategy, setEvmStrategy] = useState<ConnectionStrategy | null>(null)
  useEffect(() => {
    if (!walletConfig?.ethereum && !bridge) {
      setEvmStrategy(null)
      return
    }
    let cancelled = false
    if (bridge) {
      import('../core/strategies/EthereumBridgeStrategy.js').then((m) => {
        if (!cancelled) setEvmStrategy(m.createEthereumBridgeStrategy(bridge, bridgeConnectors))
      })
    } else {
      import('../core/strategies/EthereumEmbeddedStrategy.js').then((m) => {
        if (!cancelled) setEvmStrategy(m.createEthereumEmbeddedStrategy(walletConfig))
      })
    }
    return () => {
      cancelled = true
    }
  }, [bridge, bridgeConnectors, walletConfig])

  // ---- Zustand store + Openfort client ----
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge

  // ---- Openfort instance ----
  // The client is a per-provider singleton: it owns the embedded-signer session, and its identity
  // gates the store, the embedded-state watcher subscription and every callback below. Consumers
  // pass `openfortConfig` as an object literal, so depending on it would rebuild the client on
  // every render and drop the session.
  // Contract: credentials are read once per provider mount — to switch `publishableKey` or
  // `shieldConfiguration` at runtime, remount the provider (e.g. give it a React `key`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: openfortConfig is read once at mount by design, see above
  const openfort = useMemo(() => {
    logger.log('Creating Openfort instance.', openfortConfig)

    if (!openfortConfig.baseConfiguration.publishableKey)
      throw Error('CoreOpenfortProvider requires a publishableKey to be set in the baseConfiguration.')

    let resolvedShieldConfig = openfortConfig.shieldConfiguration
    if (resolvedShieldConfig && !resolvedShieldConfig.passkeyRpId && typeof window !== 'undefined') {
      resolvedShieldConfig = {
        passkeyRpId: window.location.hostname,
        passkeyRpName: document.title || 'Openfort app',
        ...resolvedShieldConfig,
      }
    }

    return createOpenfortClient({ ...openfortConfig, shieldConfiguration: resolvedShieldConfig })
  }, [])
  const openfortQueryScope = getOpenfortQueryScope(openfort)

  // The store is the single source of truth shared by every consumer through StoreContext, so it
  // is created once per provider mount: recreating it would reset user, accounts and embedded
  // state and detach all existing subscriptions. `chainType` and `connectOnLogin` therefore only
  // seed it — chainType is kept in sync by the layout effect below, and connectOnLogin is read
  // from the wallet config as it stands at mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the store must outlive its seed values, see above
  const store = useMemo(() => {
    return createOpenfortStore(
      chainType,
      openfort,
      () => ({
        hasBridge: !!bridgeRef.current,
        address: bridgeRef.current?.account.address,
      }),
      walletConfig?.connectOnLogin ?? true
    )
  }, [])

  // Sync chainType from UI context into the store — useLayoutEffect so the store
  // is updated before the next paint, preventing a one-render-cycle race where
  // the strategy context (synchronous) sees SVM but the store still shows EVM.
  useLayoutEffect(() => {
    store.getState().setChainType(chainType)
  }, [store, chainType])

  // Recompute isLoading when bridge address changes (bridge connects/disconnects)
  const address = bridge?.account.address
  // biome-ignore lint/correctness/useExhaustiveDependencies: `address` is the trigger, not an input — recomputeIsLoading reads the current bridge account through the store's own getter
  useEffect(() => {
    store.getState().recomputeIsLoading()
  }, [store, address])

  const strategy = useMemo(() => {
    const strategyByChain: Partial<Record<ChainTypeEnum, ConnectionStrategy | null>> = {
      [ChainTypeEnum.SVM]: solanaStrategy,
      [ChainTypeEnum.EVM]: evmStrategy,
    }
    return strategyByChain[chainType] ?? null
  }, [chainType, solanaStrategy, evmStrategy])

  const explicitLogoutRef = useRef<AuthTransition<void> | null>(null)
  const explicitLogoutUnauthenticatedRef = useRef<AuthTransition<void> | null>(null)

  // ---- Embedded state ----
  useEffect(() => {
    showInitBanner()
    if (!openfort) return
    const unwatch = openfort.embeddedWallet.watchEmbeddedState({
      onChange: (state, prevState) => {
        logger.log(
          'Embedded state changed:',
          EmbeddedState[state],
          '(prev:',
          prevState !== undefined ? EmbeddedState[prevState] : 'none',
          ')'
        )
        store.getState().setEmbeddedState(state)
      },
      onError: (error) => {
        logger.error('Error watching embedded state:', error)
      },
    })
    return unwatch
  }, [openfort, store])

  useEffect(() => {
    const handleConnectionLost = ({ reason }: EmbeddedWalletConnectionLostPayload) => {
      if (reason !== 'iframe-reloaded') return
      if (store.getState().embeddedState !== EmbeddedState.READY) return

      store.getState().setEmbeddedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)
    }

    openfort.eventEmitter.on(OpenfortEvents.ON_EMBEDDED_WALLET_CONNECTION_LOST, handleConnectionLost)
    return () => {
      openfort.eventEmitter.off(OpenfortEvents.ON_EMBEDDED_WALLET_CONNECTION_LOST, handleConnectionLost)
    }
  }, [openfort, store])

  const sessionGenerationRef = useRef(0)
  const userFetchSeqRef = useRef(0)
  const fetchSeqRef = useRef(0)
  const accountsFetchInFlightRef = useRef<{
    key: string
    promise: Promise<EmbeddedAccount[]>
  } | null>(null)
  const [silentRefetchInProgress, setSilentRefetchInProgress] = useState(false)
  const [isAccountsPending, setAccountsPending] = useState(false)

  const invalidateSessionWork = useCallback(() => {
    sessionGenerationRef.current += 1
    invalidatePersistentOperations(openfort)
    setAccountsPending(false)
    setSilentRefetchInProgress(false)
  }, [openfort])

  useEffect(
    () => () => {
      invalidatePersistentOperations(openfort)
    },
    [openfort]
  )

  const invalidateSession = useCallback(() => {
    invalidateSessionWork()
    invalidateEmbeddedSignerOperations(openfort)
  }, [invalidateSessionWork, openfort])

  const startAuthTransition = useCallback(
    <T,>(mutation: () => Promise<T>) => {
      const transition = reserveAuthTransition(openfort, mutation)
      invalidateSessionWork()
      holdEmbeddedSignerOperationsDuringAuthTransition(openfort, transition.result)
      return transition
    },
    [invalidateSessionWork, openfort]
  )

  const startAuthenticatedMutation = useCallback(
    <T,>(mutation: () => Promise<T>) => reserveAuthenticatedMutation(openfort, mutation),
    [openfort]
  )

  const captureCurrentAuthSession = useCallback(() => captureAuthSession(openfort), [openfort])

  const clearSessionState = useCallback(
    (shouldInvalidateSession = true) => {
      if (shouldInvalidateSession) {
        const explicitLogout = explicitLogoutUnauthenticatedRef.current
        if (explicitLogout) {
          explicitLogoutUnauthenticatedRef.current = null
          if (!explicitLogout.isCurrent()) return
        } else {
          const transition = startAuthTransition(() => openfort.auth.logout())
          void transition.result.catch((error) => {
            if (transition.isCurrent()) logger.error('Failed to clear unauthenticated credentials', error)
          })
        }
      }
      const state = store.getState()
      state.setUser(null)
      state.setLinkedAccounts([])
      state.setActiveEmbeddedAddress(undefined)
      state.setEmbeddedAccounts(undefined)
      state.setIsLoadingAccounts(false)
      state.setWalletStatus({ status: 'idle' })
      state.setRecoveryError(null)
      queryClient.removeQueries({ queryKey: openfortKeys.user(openfortQueryScope), exact: true })
      queryClient.removeQueries({ queryKey: openfortKeys.embeddedAccounts(openfortQueryScope), exact: true })
      queryClient.removeQueries({
        predicate: (query) => isAccountQueryOwnedByClient(query.queryKey, openfortQueryScope),
      })
    },
    [openfort, openfortQueryScope, queryClient, startAuthTransition, store]
  )

  const publishAuthenticatedUser = useCallback(
    (user: User): User => {
      const state = store.getState()
      if (state.user?.id !== user.id) {
        invalidateSession()
        state.setLinkedAccounts([])
        state.setActiveEmbeddedAddress(undefined)
        state.setEmbeddedAccounts(undefined)
        state.setWalletStatus({ status: 'idle' })
        state.setRecoveryError(null)
        queryClient.removeQueries({ queryKey: openfortKeys.embeddedAccounts(openfortQueryScope), exact: true })
        queryClient.removeQueries({
          predicate: (query) => isAccountQueryOwnedByClient(query.queryKey, openfortQueryScope),
        })
      }
      state.setLinkedAccounts(user.linkedAccounts ?? [])
      state.setUser(user)
      queryClient.setQueryData(openfortKeys.user(openfortQueryScope), user)
      return user
    },
    [invalidateSession, openfortQueryScope, queryClient, store]
  )

  const updateUser = useCallback(
    async (user?: User, logoutOnError: boolean = false) => {
      if (!openfort) return null
      logger.log('Updating user', { hasUser: !!user, logoutOnError })

      if (user) {
        return publishAuthenticatedUser(user)
      }

      const generation = sessionGenerationRef.current
      const seq = ++userFetchSeqRef.current
      try {
        const user = await fetchUser(openfort)
        if (generation !== sessionGenerationRef.current || seq !== userFetchSeqRef.current) return null
        logger.log('Getting user')
        // A user with no linked accounts omits the field; the store holds a list
        // that callers iterate unguarded, so it stays an array either way.
        return publishAuthenticatedUser(user)
      } catch (err: unknown) {
        if (generation !== sessionGenerationRef.current || seq !== userFetchSeqRef.current) return null
        logger.log('Error getting user', err)
        if (!logoutOnError) return null

        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined
        // Read logout from the store rather than capturing it: the store holds the live
        // implementation, injected by the layout effect at the bottom of this provider.
        if (status === 404) {
          logger.log('User not found, logging out')
          store.getState().logout()
        } else if (status === 401) {
          logger.log('User not authenticated, logging out')
          store.getState().logout()
        }
        return null
      }
    },
    [openfort, publishAuthenticatedUser, store]
  )

  const fetchEmbeddedAccounts = useCallback(
    (options?: { silent?: boolean }): Promise<EmbeddedAccount[]> => {
      const generation = sessionGenerationRef.current
      const silent = options?.silent === true
      const key = `${generation}:${store.getState().user ? 'user' : 'no-user'}:${silent ? 'silent' : 'visible'}`
      const existing = accountsFetchInFlightRef.current
      if (existing?.key === key) return existing.promise

      const seq = ++fetchSeqRef.current
      setSilentRefetchInProgress(silent)
      setAccountsPending(true)
      const promise = (async () => {
        try {
          const accounts = await fetchEmbeddedAccountsFromApi(openfort)
          if (generation === sessionGenerationRef.current && seq === fetchSeqRef.current) {
            store.getState().setEmbeddedAccounts(accounts)
            queryClient.setQueryData(openfortKeys.embeddedAccounts(openfortQueryScope), accounts)
          }
          return accounts
        } catch (error: unknown) {
          handleOAuthConfigError(error)
          throw error
        } finally {
          if (generation === sessionGenerationRef.current && seq === fetchSeqRef.current) {
            setAccountsPending(false)
            if (silent) setSilentRefetchInProgress(false)
          }
        }
      })()
      accountsFetchInFlightRef.current = { key, promise }
      const clearInFlight = () => {
        if (accountsFetchInFlightRef.current?.promise === promise) {
          accountsFetchInFlightRef.current = null
        }
      }
      void promise.then(clearInFlight, clearInFlight)
      return promise
    },
    [openfort, openfortQueryScope, store, queryClient]
  )

  const isLoadingAccounts = isAccountsPending && !silentRefetchInProgress
  useEffect(() => {
    store.getState().setIsLoadingAccounts(isLoadingAccounts)
  }, [store, isLoadingAccounts])

  const updateUserRef = useRef(updateUser)
  const fetchEmbeddedAccountsRef = useRef(fetchEmbeddedAccounts)
  useLayoutEffect(() => {
    updateUserRef.current = updateUser
    fetchEmbeddedAccountsRef.current = fetchEmbeddedAccounts
  }, [updateUser, fetchEmbeddedAccounts])

  // Subscribe to store state for effects
  const storeEmbeddedState = useStore(store, (s) => s.embeddedState)
  const storeEmbeddedAccounts = useStore(store, (s) => s.embeddedAccounts)
  const storeActiveEmbeddedAddress = useStore(store, (s) => s.activeEmbeddedAddress)
  const storeUser = useStore(store, (s) => s.user)

  useActiveAddressSync({
    openfort,
    storeEmbeddedAccounts,
    storeEmbeddedState,
    storeActiveEmbeddedAddress,
    chainType,
    store,
    walletConfig,
  })

  // Current chain for EVM provider reconfiguration
  const evmChainId =
    strategy?.chainType === ChainTypeEnum.EVM ? (bridge ? bridge.chainId : strategy?.getChainId()) : undefined

  // Track what we last initialized to avoid redundant initProvider calls when
  // the strategy object is recreated but nothing meaningful changed.
  const lastInitRef = useRef<ProviderInitKey | null>(null)
  const initQueueRef = useRef<Promise<void>>(Promise.resolve())

  // Init provider; only fetch accounts when READY (prevents list() before auth is stored)
  useEffect(() => {
    if (!openfort || !walletConfig || !strategy) return
    // EVM: only run at READY — auto-recover handles EMBEDDED_SIGNER_NOT_CONFIGURED → READY.
    // Running getEthereumProvider() concurrently with recover() causes a race condition.
    // SVM: initProvider is a no-op, safe to run anytime.
    if (storeEmbeddedState !== EmbeddedState.READY) {
      if (
        strategy.chainType === ChainTypeEnum.EVM ||
        storeEmbeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED
      ) {
        return
      }
    }

    // Skip if we already initialized with the same parameters
    const feeSponsorshipPolicy =
      evmChainId != null ? resolveEthereumFeeSponsorship(walletConfig, evmChainId)?.policy : undefined
    const initKey = { kind: strategy.kind, chainType: strategy.chainType, evmChainId, feeSponsorshipPolicy }
    if (isSameInitKey(lastInitRef.current, initKey)) return

    let cancelled = false
    initQueueRef.current = initQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (cancelled) return
        if (isSameInitKey(lastInitRef.current, initKey)) return

        await runEmbeddedSignerOperation(openfort, (operation) =>
          strategy.initProvider(openfort, walletConfig, evmChainId, operation)
        )
        if (cancelled) return
        lastInitRef.current = initKey

        // Only fetch accounts when authenticated — avoids SessionError on callback pages
        if (store.getState().embeddedState === EmbeddedState.READY) {
          await fetchEmbeddedAccounts({ silent: true })
          return
        }
        logger.log(
          '[CoreProvider] initProvider: not fetching accounts, state is',
          EmbeddedState[store.getState().embeddedState]
        )
      })
      .catch((error) => {
        logger.error('[CoreProvider] Failed to initialize the connection provider', error)
      })
    return () => {
      cancelled = true
    }
  }, [openfort, walletConfig, strategy, evmChainId, storeEmbeddedState, store, fetchEmbeddedAccounts])

  // On refresh, embeddedState reaches READY before the user is loaded, so
  // fetchEmbeddedAccounts (called inside initProvider) returns empty. Re-fetch
  // once the user becomes available while still in READY state.
  useEffect(() => {
    if (!storeUser || storeEmbeddedState !== EmbeddedState.READY) return
    if (store.getState().embeddedAccounts?.length) return
    fetchEmbeddedAccounts({ silent: true }).catch((error) => {
      logger.error('[CoreProvider] Failed to refresh embedded accounts after authentication', error)
    })
  }, [storeUser, storeEmbeddedState, store, fetchEmbeddedAccounts])

  const { isConnectedWithEmbeddedSigner, setIsConnectedWithEmbeddedSigner, connectingRef } = useEmbeddedStateMachine({
    openfort,
    storeEmbeddedState,
    storeUser,
    store,
    clearSessionState,
    updateUserRef,
    fetchEmbeddedAccountsRef,
  })

  useAutoRecovery({
    storeEmbeddedState,
    storeActiveEmbeddedAddress,
    openfort,
    walletConfig,
    store,
  })

  // Refs for UI state that the bridge-connect guard reads but should NOT trigger re-runs.
  const openRef = useRef(open)
  const routeRef = useRef(route)
  const connectorRef = useRef(connector)
  useLayoutEffect(() => {
    openRef.current = open
  }, [open])
  useLayoutEffect(() => {
    routeRef.current = route
  }, [route])
  useLayoutEffect(() => {
    connectorRef.current = connector
  }, [connector])

  useEffect(() => {
    if (!bridge || address || !storeUser) return
    if (chainType !== ChainTypeEnum.EVM) return
    if (isConnectedWithEmbeddedSigner) return
    if (connectingRef.current) return
    if (storeEmbeddedState !== EmbeddedState.READY) return
    if (bridge.account.connector && bridge.account.connector.id !== embeddedWalletId) return

    const currentRoute = routeRef.current
    const routeRoute =
      typeof currentRoute === 'object' && currentRoute && 'route' in currentRoute ? currentRoute.route : currentRoute
    if (
      openRef.current &&
      routeRoute === routes.CONNECT &&
      connectorRef.current?.id &&
      connectorRef.current.id !== embeddedWalletId
    )
      return

    const openfortConnector = bridge.connectors.find((c) => c.name === 'Openfort')
    if (!openfortConnector) return

    connectingRef.current = true
    setIsConnectedWithEmbeddedSigner(true)
    bridge.connect({ connector: openfortConnector })
  }, [
    bridge,
    address,
    storeUser,
    chainType,
    storeEmbeddedState,
    isConnectedWithEmbeddedSigner,
    connectingRef,
    setIsConnectedWithEmbeddedSigner,
  ])

  // ---- Auth functions ----

  const logout = useCallback(async () => {
    if (!openfort) return

    const transition = startAuthTransition(() => openfort.auth.logout())
    explicitLogoutRef.current = transition
    explicitLogoutUnauthenticatedRef.current = transition
    clearSessionState(false)
    connectingRef.current = false
    setIsConnectedWithEmbeddedSigner(false)
    lastInitRef.current = null
    logger.log('Logging out...')
    let sdkLogoutSucceeded = false
    try {
      await transition.result
      sdkLogoutSucceeded = true
      if (!transition.isCurrent()) return
      if (bridge) {
        await bridge.disconnect()
        if (!transition.isCurrent()) return
        bridge.reset()
      }
    } catch (error) {
      if (!sdkLogoutSucceeded && explicitLogoutUnauthenticatedRef.current === transition) {
        explicitLogoutUnauthenticatedRef.current = null
      }
      if (!transition.isCurrent()) return
      throw error
    } finally {
      if (explicitLogoutRef.current === transition) explicitLogoutRef.current = null
    }
  }, [openfort, bridge, connectingRef, setIsConnectedWithEmbeddedSigner, clearSessionState, startAuthTransition])

  const signUpGuest = useCallback(async () => {
    if (!openfort) return

    let isCurrent: (() => boolean) | undefined
    try {
      logger.log('Signing up as guest...')
      const transition = startAuthTransition(() => openfort.auth.signUpGuest())
      isCurrent = transition.isCurrent
      await transition.result
      if (!transition.isCurrent()) return
      await updateUser()
      if (!transition.isCurrent()) return
      logger.log('Signed up as guest')
    } catch (error) {
      if (isCurrent && !isCurrent()) return
      logger.error('Error logging in as guest:', error)
    }
  }, [openfort, startAuthTransition, updateUser])

  // ---- Inject actions into store ----
  useLayoutEffect(() => {
    store.setState({
      logout,
      signUpGuest,
      updateUser,
      updateEmbeddedAccounts: fetchEmbeddedAccounts,
      setChainType,
    })
  }, [store, logout, signUpGuest, updateUser, fetchEmbeddedAccounts, setChainType])

  const authTransitionContextValue = useMemo<AuthTransitionContextValue>(
    () => ({
      captureAuthSession: captureCurrentAuthSession,
      startAuthTransition,
      startAuthenticatedMutation,
    }),
    [captureCurrentAuthSession, startAuthenticatedMutation, startAuthTransition]
  )

  return createElement(
    AuthTransitionContext.Provider,
    { value: authTransitionContextValue },
    createElement(
      StoreContext.Provider,
      { value: store },
      createElement(
        ConnectionStrategyProvider,
        { strategy },
        createElement(Fragment, null, createElement(ConnectLifecycleEffect, { onConnect, onDisconnect }), children)
      )
    )
  )
}
