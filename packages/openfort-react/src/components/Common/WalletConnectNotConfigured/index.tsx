'use client'

import { useEffect } from 'react'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { isWalletConnectConnector } from '../../../utils'
import ErrorFallbackPage from '../ErrorFallbackPage'

/** True when a WalletConnect connector is configured (i.e. a projectId was provided). */
export function useHasWalletConnect(): boolean {
  const bridge = useEthereumBridge()
  return !!bridge?.connectors.some((c) => isWalletConnectConnector(c.id))
}

/**
 * Shown when a WalletConnect-dependent flow is opened but no WalletConnect
 * projectId was configured. End users get neutral copy; the actionable
 * config hint goes to the developer console.
 */
const WalletConnectNotConfigured = () => {
  useEffect(() => {
    // biome-ignore lint/suspicious/noConsole: config error must reach developers without debug mode
    console.warn(
      '[Openfort-React] WalletConnect is not configured: pass walletConnectProjectId to getDefaultConnectors (e.g. via your WalletConnect env variable) to enable external wallet connections.'
    )
  }, [])

  return (
    <ErrorFallbackPage
      header="Wallet connections unavailable"
      description="External wallet connections aren't available right now. Please use another sign-in method."
    />
  )
}

export default WalletConnectNotConfigured
