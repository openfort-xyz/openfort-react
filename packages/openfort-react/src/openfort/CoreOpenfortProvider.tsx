'use client'

import { ChainTypeEnum, EmbeddedState, type Openfort, type User } from '@openfort/openfort-js'
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
import { routes } from '../components/Openfort/types'
import { useOpenfort } from '../components/Openfort/useOpenfort'
import { embeddedWalletId } from '../constants/openfort'
import type { ConnectionStrategy } from '../core/ConnectionStrategy'
import { ConnectionStrategyProvider, useConnectionStrategy } from '../core/ConnectionStrategyContext'
import { resolveEthereumFeeSponsorship } from '../core/strategyUtils'
import { OpenfortEthereumBridgeContext } from '../ethereum/OpenfortEthereumBridgeContext'
import { useConnectLifecycle } from '../hooks/useConnectLifecycle'
import { showInitBanner } from '../utils/banner'
import { logger } from '../utils/logger'
import { handleOAuthConfigError } from '../utils/oauthErrorHandler'
import { mapBridgeConnectorsToWalletProps } from '../wallets/useExternalConnectors'
import type { ConnectCallbackProps } from './connectCallbackTypes'
import { StoreContext } from './context'
import { createOpenfortClient, setDefaultClient } from './core'
import { useActiveAddressSync } from './hooks/useActiveAddressSync'
import { useAutoRecovery } from './hooks/useAutoRecovery'
import { useEmbeddedStateMachine } from './hooks/useEmbeddedStateMachine'
import type { OpenfortStore } from './store'
import { createOpenfortStore } from './store'

/**
 * Public return type for useOpenfortCore(). Matches the store shape.
 * Kept as a named type for backward compatibility with consumers that import it.
 */
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

export const CoreOpenfortProvider: React.FC<CoreOpenfortProviderProps> = ({
  children,
  onConnect,
  onDisconnect,
  openfortConfig,
}) => {
  const bridge = useContext(OpenfortEthereumBridgeContext)
  const { walletConfig, chainType, setChainType, uiConfig, open, route, connector } = useOpenfort()

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
    import('../core/strategies/SolanaEmbeddedStrategy').then((m) => {
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
      import('../core/strategies/EthereumBridgeStrategy').then((m) => {
        if (!cancelled) setEvmStrategy(m.createEthereumBridgeStrategy(bridge, bridgeConnectors))
      })
    } else {
      import('../core/strategies/EthereumEmbeddedStrategy').then((m) => {
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

    const newClient = createOpenfortClient({ ...openfortConfig, shieldConfiguration: resolvedShieldConfig })

    setDefaultClient(newClient)
    return newClient
  }, [])

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

  const updateUser = useCallback(
    async (user?: User, logoutOnError: boolean = false) => {
      if (!openfort) return null
      logger.log('Updating user', { user, logoutOnError })

      if (user) {
        store.getState().setUser(user)
        return user
      }

      try {
        const user = await openfort.user.get()
        logger.log('Getting user')
        store.getState().setLinkedAccounts(user.linkedAccounts)
        store.getState().setUser(user)
        return user
      } catch (err: unknown) {
        logger.log('Error getting user', err)
        if (!logoutOnError) return null

        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined
        if (status === 404) {
          logger.log('User not found, logging out')
          logout()
        } else if (status === 401) {
          logger.log('User not authenticated, logging out')
          logout()
        }
        return null
      }
    },
    [openfort, store]
  )

  const [silentRefetchInProgress, setSilentRefetchInProgress] = useState(false)

  const [isAccountsPending, setAccountsPending] = useState(false)
  const fetchSeqRef = useRef(0)

  const fetchEmbeddedAccounts = useCallback(
    async (options?: { silent?: boolean }) => {
      const seq = ++fetchSeqRef.current
      if (options?.silent) setSilentRefetchInProgress(true)
      setAccountsPending(true)
      try {
        const accounts = await openfort.embeddedWallet.list({
          limit: 100,
        })
        if (seq === fetchSeqRef.current) {
          store.getState().setEmbeddedAccounts(accounts)
        }
        return accounts
      } catch (error: unknown) {
        handleOAuthConfigError(error)
        throw error
      } finally {
        if (seq === fetchSeqRef.current) {
          setAccountsPending(false)
          if (options?.silent) setSilentRefetchInProgress(false)
        }
      }
    },
    [openfort, store]
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
  const lastInitRef = useRef<{
    kind: string
    chainType: ChainTypeEnum
    evmChainId: number | undefined
    feeSponsorshipPolicy: string | undefined
  } | null>(null)
  const initInProgressRef = useRef(false)

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
    const prev = lastInitRef.current
    if (
      prev &&
      prev.kind === initKey.kind &&
      prev.chainType === initKey.chainType &&
      prev.evmChainId === initKey.evmChainId &&
      prev.feeSponsorshipPolicy === initKey.feeSponsorshipPolicy
    ) {
      return
    }

    // Prevent concurrent initProvider calls
    if (initInProgressRef.current) {
      return
    }

    initInProgressRef.current = true
    let cancelled = false
    strategy
      .initProvider(openfort, walletConfig, evmChainId)
      .then(() => {
        if (cancelled) return
        lastInitRef.current = initKey

        // Only fetch accounts when authenticated — avoids SessionError on callback pages
        if (store.getState().embeddedState === EmbeddedState.READY) {
          return fetchEmbeddedAccounts({ silent: true })
        }
        logger.log(
          '[CoreProvider] initProvider: not fetching accounts, state is',
          EmbeddedState[store.getState().embeddedState]
        )
      })
      .catch((_err) => {})
      .finally(() => {
        initInProgressRef.current = false
      })
    return () => {
      // Don't reset lastInitRef/initInProgressRef here. Bridge churn during wagmi
      // hydration (walletClient/ENS resolving) recreates the strategy and re-runs
      // this effect with the same initKey; resetting would defeat the dedup and
      // re-fire initProvider → repeated /v2/accounts/switch-chain 422s.
      cancelled = true
    }
  }, [openfort, walletConfig, strategy, evmChainId, storeEmbeddedState, storeActiveEmbeddedAddress])

  // On refresh, embeddedState reaches READY before the user is loaded, so
  // fetchEmbeddedAccounts (called inside initProvider) returns empty. Re-fetch
  // once the user becomes available while still in READY state.
  // returns empty. Re-fetch once user becomes available while already READY.
  useEffect(() => {
    if (!storeUser || storeEmbeddedState !== EmbeddedState.READY) return
    if (store.getState().embeddedAccounts?.length) return
    fetchEmbeddedAccounts({ silent: true }).catch(() => {})
  }, [storeUser, storeEmbeddedState, store, fetchEmbeddedAccounts])

  const { isConnectedWithEmbeddedSigner, setIsConnectedWithEmbeddedSigner, connectingRef } = useEmbeddedStateMachine({
    openfort,
    storeEmbeddedState,
    storeUser,
    store,
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
  }, [bridge, address, storeUser, chainType, storeEmbeddedState, isConnectedWithEmbeddedSigner])

  // ---- Auth functions ----

  const logout = useCallback(async () => {
    if (!openfort) return

    store.getState().setUser(null)
    store.getState().setActiveEmbeddedAddress(undefined)
    store.getState().setEmbeddedAccounts(undefined)
    store.getState().setWalletStatus({ status: 'idle' })
    connectingRef.current = false
    setIsConnectedWithEmbeddedSigner(false)
    lastInitRef.current = null
    logger.log('Logging out...')
    await openfort.auth.logout()
    if (bridge) {
      await bridge.disconnect()
      bridge.reset()
    }
  }, [openfort, bridge, store])

  const signUpGuest = useCallback(async () => {
    if (!openfort) return

    try {
      logger.log('Signing up as guest...')
      const res = await openfort.auth.signUpGuest()
      logger.log('Signed up as guest:', res)
    } catch (error) {
      logger.error('Error logging in as guest:', error)
    }
  }, [openfort])

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

  return createElement(
    StoreContext.Provider,
    { value: store },
    createElement(
      ConnectionStrategyProvider,
      { strategy },
      createElement(Fragment, null, createElement(ConnectLifecycleEffect, { onConnect, onDisconnect }), children)
    )
  )
}
