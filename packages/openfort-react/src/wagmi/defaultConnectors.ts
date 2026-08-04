import type { CreateConnectorFn } from 'wagmi'
import { type CoinbaseWalletParameters, coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'
import { embeddedWalletConnector } from './embeddedConnector.js'

type DefaultConnectorsProps = {
  app: {
    name: string
    icon?: string
    description?: string
    url?: string
  }
  walletConnectProjectId?: string
  coinbaseWalletPreference?: CoinbaseWalletParameters<'4'>['preference']
}

const defaultConnectors = ({
  app,
  walletConnectProjectId,
  coinbaseWalletPreference,
}: DefaultConnectorsProps): CreateConnectorFn[] => {
  const hasAllAppData = app.name && app.icon && app.description && app.url
  const shouldUseSafeConnector = !(typeof window === 'undefined') && window?.parent !== window

  const connectors: CreateConnectorFn[] = [embeddedWalletConnector()]

  if (shouldUseSafeConnector) {
    connectors.push(
      safe({
        allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/],
      })
    )
  }

  // Targeted injected connectors so the browser-extension wallets surface as
  // their own entries (e.g. the deposit "transfer from wallet" list), instead of
  // a single generic "Injected" provider.
  connectors.push(injected({ target: 'metaMask' }), injected({ target: 'phantom' }))

  connectors.push(
    coinbaseWallet({
      appName: app.name,
      appLogoUrl: app.icon,
      preference: coinbaseWalletPreference,
    })
  )

  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId as string,
        metadata: hasAllAppData
          ? {
              name: app.name,
              description: app.description!,
              url: app.url!,
              icons: [app.icon!],
            }
          : undefined,
      })
    )
  }

  return connectors
}

export default defaultConnectors
