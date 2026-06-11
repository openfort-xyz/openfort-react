import type { CreateConfigParameters } from '@wagmi/core'
import { http } from 'wagmi'
import { arbitrum, mainnet, optimism, polygon } from 'wagmi/chains'
import type { CoinbaseWalletParameters } from 'wagmi/connectors'

import defaultConnectors from './defaultConnectors'

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
    ...rest,
    chains,
    connectors,
    transports,
  }
}

export default defaultConfig
