import { embeddedWalletId } from '../../../constants/openfort'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { useFamilyAccountsConnector, useFamilyConnector } from '../../../hooks/useConnectors'

import useIsMobile from '../../../hooks/useIsMobile'
import { useLastConnector } from '../../../hooks/useLastConnector'
import { isInjectedConnector } from '../../../utils'
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

  // On mobile there are no extensions: an undetected wallet with a browse
  // deeplink hands the dapp to the wallet app's own browser instead, where the
  // provider is injected. No WalletConnect pairing involved.
  const browseDeeplinkFor = (wallet: ExternalConnectorProps): string | undefined =>
    isMobile && detectedProviders && !detectedProviders.has(wallet.id) && wallet.getBrowseDeeplink
      ? wallet.getBrowseDeeplink(window.location.href)
      : undefined

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
  // Wallets with a browse deeplink stay visible on mobile: the deeplink works
  // without WalletConnect.
  if (!hasWalletConnect && detectedProviders) {
    filteredWallets = filteredWallets.filter(
      (wallet) =>
        !isInjectedConnector(wallet.connector.type) ||
        detectedProviders.has(wallet.id) ||
        (isMobile && !!wallet.getBrowseDeeplink)
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
        <ConnectorsContainer $mobile={false} $totalResults={walletsToDisplay.length}>
          {walletsToDisplay.map((wallet) => (
            <ConnectorItem
              key={wallet.id}
              wallet={wallet}
              isRecent={wallet.id === lastConnectorId}
              browseDeeplink={browseDeeplinkFor(wallet)}
            />
          ))}
        </ConnectorsContainer>
      )}
    </ScrollArea>
  )
}

export default ConnectorList

const ConnectorItem = ({
  wallet,
  isRecent,
  browseDeeplink,
}: {
  wallet: ExternalConnectorProps
  isRecent?: boolean
  browseDeeplink?: string
}) => {
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

  // A browse deeplink renders as a plain anchor: universal links are most
  // reliable when the navigation comes straight from the tap.
  if (browseDeeplink) {
    return (
      <ConnectorButton as="a" href={browseDeeplink}>
        {content()}
      </ConnectorButton>
    )
  }

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
