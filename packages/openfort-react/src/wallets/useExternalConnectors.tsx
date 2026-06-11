import { createElement } from 'react'
import { useConnectionStrategy } from '../core/ConnectionStrategyContext'
import type {
  OpenfortEthereumBridgeConnector,
  OpenfortEthereumBridgeValue,
} from '../ethereum/OpenfortEthereumBridgeContext'
import { isCoinbaseWalletConnector, isInjectedConnector } from '../utils'
import { type WalletConfigProps, walletConfigs } from './walletConfigs'

export type ExternalConnectorProps = {
  id: string
  connector: OpenfortEthereumBridgeConnector
  isInstalled?: boolean
} & WalletConfigProps

type MapBridgeConnectorsOptions = { walletConnectName?: string }

/** Maps bridge.connectors to ExternalConnectorProps[]. Used by EthereumBridgeStrategy and useExternalConnectors. */
export function mapBridgeConnectorsToWalletProps(
  bridge: OpenfortEthereumBridgeValue,
  options: MapBridgeConnectorsOptions = {}
): ExternalConnectorProps[] {
  const { walletConnectName } = options
  const wallets = bridge.connectors.map((connector): ExternalConnectorProps => {
    let walletId = Object.keys(walletConfigs).find(
      (id) =>
        id
          .split(',')
          .map((i) => i.trim())
          .indexOf(connector.id) !== -1
    )
    // Fallback: when connector.id is 'injected', match by name for known wallets (e.g. MetaMask)
    if (!walletId && connector.id === 'injected' && connector.name) {
      const nameLower = connector.name.toLowerCase()
      if (nameLower.includes('metamask')) {
        walletId =
          Object.keys(walletConfigs).find((k) => walletConfigs[k].name?.toLowerCase() === 'metamask') ?? undefined
      }
    }

    const c: ExternalConnectorProps = {
      id: connector.id,
      name: connector.name ?? connector.id ?? connector.type ?? '',
      icon: connector.icon
        ? createElement('img', { src: connector.icon, alt: connector.name, width: '100%', height: '100%' })
        : createElement('span', {
            style: {
              width: '100%',
              height: '100%',
              background: 'var(--ck-body-background)',
              borderRadius: 4,
            },
          }),
      connector,
      iconShape: 'squircle',
      isInstalled:
        connector.type === 'mock' || connector.type === 'injected' || isCoinbaseWalletConnector(connector.id),
    }

    if (walletId) {
      const wallet = walletConfigs[walletId]
      return {
        ...c,
        iconConnector: connector.icon
          ? createElement('img', { src: connector.icon, alt: connector.name, width: '100%', height: '100%' })
          : undefined,
        ...wallet,
      }
    }

    return c
  })

  return wallets
    .filter((wallet, index, self) => self.findIndex((w) => w.id === wallet.id) === index)
    .map((wallet) => {
      if (wallet.id === 'walletConnect') {
        return {
          ...wallet,
          name: walletConnectName || wallet.name,
          shortName: walletConnectName || wallet.shortName,
        }
      }
      return wallet
    })
    .sort((a, b) => {
      const AisInstalled = a.isInstalled && isInjectedConnector(a.connector.type)
      const BisInstalled = b.isInstalled && isInjectedConnector(b.connector.type)
      if (AisInstalled && !BisInstalled) return -1
      if (!AisInstalled && BisInstalled) return 1
      return 0
    })
    .sort((a, b) => {
      if (a.id === 'walletConnect') return 1
      if (b.id === 'walletConnect') return -1
      return 0
    })
}

/** Returns the list of external connectors (MetaMask, WalletConnect, etc.) for the connect UI. Uses strategy when available; returns [] when embedded-only (no bridge). */
export function useExternalConnectors(): ExternalConnectorProps[] {
  const strategy = useConnectionStrategy()
  if (!strategy) return []
  return strategy.getConnectors()
}

/** Single connector by id. */
export const useExternalConnector = (id: string): ExternalConnectorProps | null => {
  const connectors = useExternalConnectors()
  const connector = connectors.find((c) => c.id === id)
  if (!connector) return null
  return connector
}
