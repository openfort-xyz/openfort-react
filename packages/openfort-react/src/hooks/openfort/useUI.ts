'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import React from 'react'
import { type RouteOptions, type RoutesWithoutOptions, routes } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../solana/hooks/useSolanaEmbeddedWallet'
import { logger } from '../../utils/logger'

type ModalRoutes = RoutesWithoutOptions['route'] | RouteOptions

const safeRoutes: {
  connected: ModalRoutes[]
  disconnected: ModalRoutes[]
} = {
  disconnected: [
    routes.PROVIDERS,
    { route: routes.CONNECTORS, connectType: 'linkIfUserConnectIfNoUser' },
    routes.MOBILECONNECTORS,
  ],
  connected: [
    routes.CONNECTED,
    { route: routes.CONNECTORS, connectType: 'linkIfUserConnectIfNoUser' },
    routes.ETH_SWITCH_NETWORK,
    routes.PROVIDERS,
  ],
}

type ValidRoutes = ModalRoutes

/** Route can be selected by string (route name) or by object with `route` property */
function routeMatches(a: ModalRoutes, b: ModalRoutes): boolean {
  const aRoute = typeof a === 'object' && a !== null && 'route' in a ? a.route : a
  const bRoute = typeof b === 'object' && b !== null && 'route' in b ? b.route : b
  return aRoute === bRoute
}

/** Connector id must be a connector (e.g. injected, walletConnect), not an Openfort account id. */
function isAccountId(id: string): boolean {
  return id.startsWith('acc_')
}

/**
 * Hook for controlling Openfort UI modal and navigation
 *
 * This hook provides programmatic control over the Openfort UI modal, including opening,
 * closing, and navigating between different screens. It handles route validation and
 * automatically selects appropriate screens based on user connection and authentication state.
 *
 * @returns UI control functions and modal state
 *
 * @example
 * ```tsx
 * const ui = useUI();
 *
 * if (ui.isOpen) {
 *   console.log('Openfort modal is open');
 * }
 *
 * ui.open(); // Opens modal with default route
 * ui.close(); // Closes modal
 * ui.openProfile(); // Opens user profile screen
 * ```
 */
export function useUI() {
  const { open, setOpen, setRoute, setConnector, connector, chainType } = useOpenfort()
  const { isLoading, user, needsRecovery, embeddedAccounts, activeEmbeddedAddress, embeddedState } = useOpenfortCore()
  const bridge = useEthereumBridge()
  const strategy = useConnectionStrategy()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const state = React.useMemo(
    () => ({
      user,
      embeddedAccounts,
      activeEmbeddedAddress,
      chainType,
      embeddedState,
    }),
    [user, embeddedAccounts, activeEmbeddedAddress, chainType, embeddedState]
  )
  // Bridge: strategy owns connection. Embedded: wallet hooks are source of truth.
  const isConnected =
    strategy?.kind === 'bridge' ? (strategy?.isConnected(state) ?? false) : wallet.status === 'connected'

  function defaultOpen() {
    setOpen(true)
    if (isAccountId(connector.id)) {
      setConnector({ id: '' })
    }

    if (isLoading) setRoute(routes.LOADING)
    else if (!user) setRoute(routes.PROVIDERS)
    else if (!isConnected) setRoute(routes.LOAD_WALLETS)
    else if (needsRecovery && !bridge) setRoute(routes.LOAD_WALLETS)
    else setRoute(routes.CONNECTED)
  }

  const gotoAndOpen = (route: ValidRoutes) => {
    const safeList = isConnected ? safeRoutes.connected : safeRoutes.disconnected
    const fallback = isConnected ? routes.CONNECTED : routes.PROVIDERS

    // Navigate using the allowlisted spec so vetted options (e.g. connectType) are enforced,
    // not whatever the caller passed alongside a matching route name.
    const match = safeList.find((r) => routeMatches(r, route))

    if (!match) {
      logger.log(
        `Route ${JSON.stringify(route)} is not valid when ${isConnected ? 'connected' : 'disconnected'}, navigating to ${fallback} instead.`
      )
    }

    // setOpen(true) resets route/history/connector for a clean session, so it MUST run
    // before setRoute — otherwise it clobbers the requested route back to LOADING.
    setOpen(true)
    setRoute(match ?? fallback)
  }

  return {
    isOpen: open,
    open: () => defaultOpen(),
    close: () => setOpen(false),
    setIsOpen: setOpen,

    openProfile: () => gotoAndOpen(routes.CONNECTED),
    openSwitchNetworks: () => gotoAndOpen(routes.ETH_SWITCH_NETWORK),
    openProviders: () => gotoAndOpen(routes.PROVIDERS),
    openWallets: () => gotoAndOpen({ route: routes.CONNECTORS, connectType: 'linkIfUserConnectIfNoUser' }),
  }
}
