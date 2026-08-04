import type { CreateConfigParameters } from 'wagmi'
import { http } from 'wagmi'
import { arbitrum, mainnet, optimism, polygon } from 'wagmi/chains'
import type { CoinbaseWalletParameters } from 'wagmi/connectors'

import defaultConnectors from './defaultConnectors.js'

type DefaultConfigProps = {
  appName: string
  appIcon?: string
  appDescription?: string
  appUrl?: string
  walletConnectProjectId?: string
  coinbaseWalletPreference?: CoinbaseWalletParameters<'4'>['preference']
} & Partial<CreateConfigParameters>

const defaultConfig = ({
  appName = 'Openfort',
  appIcon,
  appDescription,
  appUrl,
  walletConnectProjectId,
  coinbaseWalletPreference,
  chains = [mainnet, polygon, optimism, arbitrum],
  ...props
}: DefaultConfigProps): CreateConfigParameters => {
  const { client: _client, transports: _transports, connectors: _connectors, ...rest } = props

  const transports: CreateConfigParameters['transports'] =
    _transports ?? Object.fromEntries(chains.map((chain) => [chain.id, http()]))

  const connectors: CreateConfigParameters['connectors'] =
    _connectors ??
    defaultConnectors({
      app: {
        name: appName,
        icon: appIcon,
        description: appDescription,
        url: appUrl,
      },
      walletConnectProjectId,
      coinbaseWalletPreference,
    })

  return {
    // Wagmi otherwise hydrates its external store during render. SDK bridge
    // subscribers can then be updated while Hydrate is rendering, which React
    // correctly reports as a render-phase update.
    ssr: true,
    ...rest,
    chains,
    connectors,
    transports,
  }
}

export default defaultConfig
