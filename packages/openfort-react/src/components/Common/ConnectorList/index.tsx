import { embeddedWalletId } from '../../../constants/openfort'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { useFamilyAccountsConnector, useFamilyConnector } from '../../../hooks/useConnectors'

import useIsMobile from '../../../hooks/useIsMobile'
import { useLastConnector } from '../../../hooks/useLastConnector'
import { isInjectedConnector, isWalletConnectConnector } from '../../../utils'
import { isFamily } from '../../../utils/wallets'
import {
  type ExternalConnectorProps,
  useDetectedProviders,
  useExternalConnectors,
} from '../../../wallets/useExternalConnectors'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import Alert from '../Alert'
import { ScrollArea } from '../ScrollArea'
import { useHasWalletConnect } from '../WalletConnectNotConfigured'
import { ConnectorButton, ConnectorIcon, ConnectorLabel, ConnectorsContainer, RecentlyUsedTag } from './styles'

const ConnectorList = () => {
  const context = useOpenfort()
  const isMobile = useIsMobile()

  const wallets = useExternalConnectors()
  const { lastConnectorId } = useLastConnector()
  const familyConnector = useFamilyConnector()
  const familyAccountsConnector = useFamilyAccountsConnector()
  const hasWalletConnect = useHasWalletConnect()
  const detectedProviders = useDetectedProviders()

  let filteredWallets = wallets.filter(
    (wallet) => wallet.id !== familyAccountsConnector?.id && wallet.id !== embeddedWalletId
  )
  if (familyConnector && isFamily()) {
    filteredWallets = filteredWallets.filter((wallet) => wallet.id !== familyConnector?.id)
  }

  // Without WalletConnect there is no QR/modal fallback, so an injected wallet
  // whose provider isn't actually present (extension not installed; mobile
  // browser outside the wallet's in-app browser) can never connect — hide it
  // instead of dead-ending on the "Wallet connections unavailable" page.
  if (!hasWalletConnect && detectedProviders) {
    filteredWallets = filteredWallets.filter(
      (wallet) => !isInjectedConnector(wallet.connector.type) || detectedProviders.has(wallet.id)
    )
  }

  const walletsToDisplay =
    context.uiConfig.hideRecentBadge || lastConnectorId === 'walletConnect' // do not hoist walletconnect to top of list
      ? filteredWallets
      : [
          // move last used wallet to top of list
          // using .filter and spread to avoid mutating original array order with .sort
          ...filteredWallets.filter((wallet) => lastConnectorId === wallet.connector.id),
          ...filteredWallets.filter((wallet) => lastConnectorId !== wallet.connector.id),
        ]

  return (
    <ScrollArea mobileDirection={'horizontal'}>
      {walletsToDisplay.length === 0 && <Alert error>No connectors found in Openfort config.</Alert>}
      {walletsToDisplay.length > 0 && (
        <ConnectorsContainer $mobile={isMobile} $totalResults={walletsToDisplay.length}>
          {walletsToDisplay.map((wallet) => (
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

  // On mobile the WalletConnect row is the "Other" tile: the mini wallet grid
  // on a tinted tile, opening the WalletConnect modal (our more-wallets surface).
  const isOtherTile = isMobile && isWalletConnectConnector(wallet.id)

  const content = () => (
    <>
      <ConnectorIcon data-small={wallet.iconShouldShrink} data-shape={wallet.iconShape} data-background={isOtherTile}>
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
