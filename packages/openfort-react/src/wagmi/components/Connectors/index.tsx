'use client'

import ConnectorList from '../../../components/Common/ConnectorList/index.js'
import { PageContent } from '../../../components/PageContent/index.js'

/**
 * Lists the external wallet connectors configured on the wagmi config.
 *
 * Embedded-wallet-only apps never route here; the page is reached when the app
 * offers external wallet connections.
 */
const Connectors = ({ logoutOnBack }: { logoutOnBack?: boolean }) => (
  <PageContent logoutOnBack={logoutOnBack} width={312}>
    <ConnectorList />
  </PageContent>
)

export default Connectors
