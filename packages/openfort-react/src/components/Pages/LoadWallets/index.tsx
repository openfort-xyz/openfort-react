'use client'

import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { useEffect, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import type { ConnectedEmbeddedEthereumWallet } from '../../../ethereum/types'
import { toSolanaUserWallet } from '../../../hooks/openfort/walletTypes'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import type { ConnectedEmbeddedSolanaWallet } from '../../../solana/types'
import { logger } from '../../../utils/logger'
import Loader from '../../Common/Loading'
import NotFoundFallback from '../../Common/NotFoundFallback'
import { createRoute, recoverRoute } from '../../Openfort/routeHelpers'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'

/** Pick the best wallet to auto-recover: automatic > passkey > first available */
function pickBestWallet(
  wallets: ReadonlyArray<ConnectedEmbeddedEthereumWallet | ConnectedEmbeddedSolanaWallet>
): ConnectedEmbeddedEthereumWallet | ConnectedEmbeddedSolanaWallet {
  return (
    wallets.find((w) => w.recoveryMethod === RecoveryMethod.AUTOMATIC) ??
    wallets.find((w) => w.recoveryMethod === RecoveryMethod.PASSKEY) ??
    wallets[0]
  )
}

function routeToRecover(
  wallet: ConnectedEmbeddedEthereumWallet | ConnectedEmbeddedSolanaWallet,
  chainType: ChainTypeEnum,
  setRoute: (opts: ReturnType<typeof recoverRoute>) => void
) {
  if (chainType === ChainTypeEnum.SVM) {
    setRoute(recoverRoute(chainType, toSolanaUserWallet(wallet as ConnectedEmbeddedSolanaWallet)))
  } else {
    setRoute(recoverRoute(chainType, wallet as ConnectedEmbeddedEthereumWallet))
  }
}

const errorForChainRegistry: Record<
  ChainTypeEnum.EVM | ChainTypeEnum.SVM,
  (errorWallets: Error | undefined) => { isError: boolean; message: string | undefined }
> = {
  [ChainTypeEnum.SVM]: () => ({ isError: false, message: undefined }),
  [ChainTypeEnum.EVM]: (errorWallets) => ({
    isError: !!errorWallets,
    message: errorWallets?.message || 'There was an error loading wallets',
  }),
}

// Watchdog: if wallet loading never settles (hung fetch, unreachable state),
// bail out to the not-found fallback instead of spinning forever.
const LOADING_TIMEOUT_MS = 10_000

const LoadWallets: React.FC = () => {
  const { chainType, user, isLoadingAccounts } = useOpenfortCore()
  const { triggerResize, setRoute, setConnector, walletConfig } = useOpenfort()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const connectOnLogin = walletConfig?.connectOnLogin ?? true

  const [loadingUX, setLoadingUX] = useState(true)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [])

  const wallets = embeddedWallet.wallets
  const isLoadingWallets =
    embeddedWallet.status === 'fetching-wallets' ||
    embeddedWallet.status === 'connecting' ||
    embeddedWallet.status === 'creating' ||
    // For Solana, the hook never enters 'fetching-wallets' — accounts are derived from the
    // core embeddedAccounts store. Wait for the core fetch to complete before routing.
    isLoadingAccounts
  const errorWallets = embeddedWallet.status === 'error' ? new Error(embeddedWallet.error) : undefined

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (!isLoadingWallets) {
      timeout = setTimeout(() => {
        setLoadingUX(false)
        triggerResize()
      }, 500)
    }
    return () => clearTimeout(timeout)
  }, [isLoadingWallets, triggerResize])

  useEffect(() => {
    if (loadingUX) return
    if (isLoadingWallets) return
    if (!wallets) {
      logger.error('Could not load wallets for user:', user)
      return
    }
    logger.log('User wallets loaded:', wallets.length)

    // No wallets → create one
    if (wallets.length === 0) {
      setRoute(createRoute(chainType))
      return
    }

    // If a wallet is already active and connected, go to connected (triggers auto-close)
    if (embeddedWallet.status === 'connected' && embeddedWallet.address) {
      const activeAddr = embeddedWallet.address
      const isActiveInList = wallets.some((w) =>
        chainType === ChainTypeEnum.SVM
          ? w.address === activeAddr
          : (w.address as string).toLowerCase() === (activeAddr as string).toLowerCase()
      )
      if (isActiveInList) {
        setRoute(chainType === ChainTypeEnum.SVM ? routes.SOL_CONNECTED : routes.ETH_CONNECTED)
        return
      }
    }

    if (connectOnLogin) {
      // Auto-connect: pick the best wallet (automatic > passkey > password) and recover it
      const best = pickBestWallet(wallets)
      routeToRecover(best, chainType, setRoute)
    } else {
      // Not auto-connecting: close modal (go to connected page which triggers auto-close)
      setRoute(chainType === ChainTypeEnum.SVM ? routes.SOL_CONNECTED : routes.ETH_CONNECTED)
    }
  }, [loadingUX, isLoadingWallets, wallets, user, chainType, setRoute, setConnector, walletConfig, connectOnLogin])

  const { isError: isErrorFromChain, message: errorMessageFromChain } = errorForChainRegistry[chainType](errorWallets)
  const isError = !user || isErrorFromChain
  const errorMessage = !user ? undefined : errorMessageFromChain

  // Only fall back while still spinning — real errors keep their own message
  if (timedOut && !isError) return <NotFoundFallback />

  return (
    <PageContent onBack={!user ? 'back' : null}>
      <Loader
        header="Setting up wallet"
        isError={isError}
        description={isError ? errorMessage : 'Setting up wallets'}
      />
    </PageContent>
  )
}

export default LoadWallets
