'use client'

import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import React, { useEffect } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Loader from '../../Common/Loading'
import NotFoundFallback from '../../Common/NotFoundFallback'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'

// Watchdog: if no state transition routes us away within this window, the modal
// would otherwise spin forever (e.g. opened while signed out, or a misconfigured SDK).
const LOADING_TIMEOUT_MS = 10_000

const Loading: React.FC = () => {
  const { setRoute, walletConfig } = useOpenfort()
  const { user, isLoadingAccounts, isLoading, needsRecovery, embeddedState } = useOpenfortCore()
  const { chainType } = useOpenfortCore()
  const bridge = useEthereumBridge()

  // Use chain-specific hooks
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  // Check embedded wallet or bridge (external wallet) connection
  const embeddedConnected = wallet.status === 'connected'
  const bridgeConnected = chainType === ChainTypeEnum.EVM && !!(bridge?.account.isConnected && bridge?.account.address)
  const address = embeddedConnected ? wallet.address : bridgeConnected ? bridge?.account.address : undefined

  const [isFirstFrame, setIsFirstFrame] = React.useState(true)
  const [retryCount, setRetryCount] = React.useState(0)
  const [timedOut, setTimedOut] = React.useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (isFirstFrame) return

    // Wait for the SDK to settle. After storeCredentials the embedded state
    // briefly stays UNAUTHENTICATED/NONE while the SDK processes the token.
    // Routing to PROVIDERS here would abort the auth flow.
    // However, if bridge (external wallet) is already connected, don't block routing.
    if ((embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) && !bridgeConnected)
      return
    // Also wait while accounts or user are still loading.
    if (isLoadingAccounts || isLoading) return
    else if (!user) setRoute(routes.PROVIDERS)
    else if (!address) {
      if (!walletConfig) setRoute({ route: routes.CONNECTORS, connectType: 'connect' })
      else setRoute(routes.LOAD_WALLETS)
    } else if (needsRecovery) {
      if (!walletConfig) setRoute({ route: routes.CONNECTORS, connectType: 'connect' })
      else setRoute(routes.LOAD_WALLETS)
    } else setRoute(routes.CONNECTED)
  }, [embeddedState, isLoadingAccounts, isLoading, user, address, needsRecovery, isFirstFrame, retryCount])

  // Retry every 250ms
  useEffect(() => {
    const interval = setInterval(() => {
      setRetryCount((r) => r + 1)
    }, 250)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // UX: Wait a bit before showing the next page
    setTimeout(() => setIsFirstFrame(false), 400)
  }, [])

  if (timedOut) return <NotFoundFallback />

  return (
    <PageContent>
      <Loader header="Redirecting" />
    </PageContent>
  )
}

export default Loading
