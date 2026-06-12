'use client'

import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { isWalletConnectConnector } from '../../../utils'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import Button from '../Button'
import Loader from '../Loading'

/** True when a WalletConnect connector is configured (i.e. a projectId was provided). */
export function useHasWalletConnect(): boolean {
  const bridge = useEthereumBridge()
  return !!bridge?.connectors.some((c) => isWalletConnectConnector(c.id))
}

/**
 * Shown when a WalletConnect-dependent flow is opened but no WalletConnect
 * projectId was configured (e.g. the WalletConnect env variable is missing).
 */
const WalletConnectNotConfigured = () => {
  const { setRoute } = useOpenfort()

  return (
    <PageContent onBack={routes.PROVIDERS}>
      <Loader
        header="WalletConnect is not configured"
        isError
        description="Set your WalletConnect project ID environment variable to enable external wallet connections."
      />
      <Button onClick={() => setRoute(routes.PROVIDERS)}>Back to sign in</Button>
    </PageContent>
  )
}

export default WalletConnectNotConfigured
