'use client'

import { ChainTypeEnum, EmbeddedState } from '@openfort/openfort-js'
import React, { useEffect } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Loader from '../../Common/Loading'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'

const Loading: React.FC = () => {
  const { setRoute, walletConfig } = useOpenfort()
  const { user, isLoadingAccounts, isLoading, needsRecovery, embeddedState } = useOpenfortCore()
  const { chainType } = useOpenfortCore()

  // Use chain-specific hooks
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const isConnected = wallet.status === 'connected'
  const address = isConnected ? wallet.address : undefined

  const [isFirstFrame, setIsFirstFrame] = React.useState(true)
  const [retryCount, setRetryCount] = React.useState(0)

  useEffect(() => {
    if (isFirstFrame) return

    // Wait for the SDK to settle. After storeCredentials the embedded state
    // briefly stays UNAUTHENTICATED/NONE while the SDK processes the token.
    // Routing to PROVIDERS here would abort the auth flow.
    if (embeddedState === EmbeddedState.NONE || embeddedState === EmbeddedState.UNAUTHENTICATED) return
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

  return (
    <PageContent>
      <Loader header="Redirecting" />
    </PageContent>
  )
}

export default Loading
