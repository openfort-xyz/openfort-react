'use client'

import { embeddedWalletId } from '../../../constants/openfort.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import { useFamilyAccountsConnector, useFamilyConnector } from '../../../hooks/useConnectors.js'

import useIsMobile from '../../../hooks/useIsMobile.js'
import { useLastConnector } from '../../../hooks/useLastConnector.js'
import { isFamily } from '../../../utils/wallets.js'
import { type ExternalConnectorProps, useExternalConnectors } from '../../../wallets/useExternalConnectors.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import Alert from '../Alert/index.js'
import { ScrollArea } from '../ScrollArea/index.js'
import { ConnectorButton, ConnectorIcon, ConnectorLabel, ConnectorsContainer, RecentlyUsedTag } from './styles.js'

const ConnectorList = () => {
  const context = useOpenfort()

  const wallets = useExternalConnectors()
  const { lastConnectorId } = useLastConnector()
  const familyConnector = useFamilyConnector()
  const familyAccountsConnector = useFamilyAccountsConnector()

  let filteredWallets = wallets.filter(
    (wallet) => wallet.id !== familyAccountsConnector?.id && wallet.id !== embeddedWalletId
  )
  if (familyConnector && isFamily()) {
    filteredWallets = filteredWallets.filter((wallet) => wallet.id !== familyConnector?.id)
  }

  const walletsToDisplay =
    context.uiConfig.hideRecentBadge || lastConnectorId === 'walletConnect' // do not hoist walletconnect to top of list
      ? wallets
      : [
          // move last used wallet to top of list
          // using .filter and spread to avoid mutating original array order with .sort
          ...wallets.filter((wallet) => lastConnectorId === wallet.connector.id && wallet.id !== embeddedWalletId),
          ...wallets.filter((wallet) => lastConnectorId !== wallet.connector.id && wallet.id !== embeddedWalletId),
        ]

  return (
    <ScrollArea mobileDirection={'horizontal'}>
      {filteredWallets.length === 0 && <Alert error>No connectors found in Openfort config.</Alert>}
      {filteredWallets.length > 0 && (
        <ConnectorsContainer $mobile={false} $totalResults={walletsToDisplay.length}>
          {filteredWallets.map((wallet) => (
            <ConnectorItem key={wallet.id} wallet={wallet} isRecent={wallet.id === lastConnectorId} />
          ))}
        </ConnectorsContainer>
      )}
    </ScrollArea>
  )
}

export default ConnectorList

const ConnectorItem = ({ wallet, isRecent }: { wallet: ExternalConnectorProps; isRecent?: boolean }) => {
  const isMobile = useIsMobile()
  const context = useOpenfort()
  const bridge = useEthereumBridge()
  const connector = bridge?.account?.connector

  const content = () => (
    <>
      <ConnectorIcon data-small={wallet.iconShouldShrink} data-shape={wallet.iconShape}>
        {wallet.iconConnector ?? wallet.icon}
      </ConnectorIcon>
      <ConnectorLabel>
        {isMobile ? (wallet.shortName ?? wallet.name) : wallet.name}
        {!context.uiConfig.hideRecentBadge && isRecent && (
          <RecentlyUsedTag>
            <span>Recent</span>
          </RecentlyUsedTag>
        )}
      </ConnectorLabel>
    </>
  )

  return (
    <ConnectorButton
      type="button"
      onClick={async () => {
        // Only disconnect if actually connected and switching connectors or reconnecting WC
        if (bridge?.account?.isConnected && (wallet.id === 'walletConnect' || wallet.id === connector?.id)) {
          await bridge.disconnect()
        }

        context.setRoute({ route: routes.CONNECT, connectType: 'linkIfUserConnectIfNoUser' })
        context.setConnector({ id: wallet.id })
      }}
    >
      {content()}
    </ConnectorButton>
  )
}
