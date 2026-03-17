'use client'

/**
 * @deprecated This component requires wagmi and will be moved to @openfort/react/wagmi in v3.0.
 * For embedded wallets, external wallet connections are not needed.
 * This component is only used for connecting external wallets via WalletConnect.
 */
import { logger } from '../../../utils/logger'
import ConnectorList from '../../Common/ConnectorList'
import { PageContent } from '../../PageContent'

let hasWarnedConnectors = false

const Connectors = ({ logoutOnBack }: { logoutOnBack?: boolean }) => {
  // Runtime deprecation warning
  if (process.env.NODE_ENV === 'development' && !hasWarnedConnectors) {
    logger.warn(
      '[@openfort/react] <Connectors /> is deprecated and will be moved to @openfort/react/wagmi in v3.0.\n' +
        'For embedded wallets, external wallet connections are not needed.\n' +
        'See: https://openfort.io/docs/migration/external-wallets'
    )
    hasWarnedConnectors = true
  }

  return (
    <PageContent logoutOnBack={logoutOnBack} width={312}>
      <ConnectorList />
    </PageContent>
  )
}

export default Connectors
