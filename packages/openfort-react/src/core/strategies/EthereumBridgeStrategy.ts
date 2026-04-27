import { ChainTypeEnum, type Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext'
import { logger } from '../../utils/logger'
import type { ExternalConnectorProps } from '../../wallets/useExternalConnectors'
import type { ConnectionStrategy } from '../ConnectionStrategy'
import { resolveEthereumFeeSponsorship } from '../strategyUtils'

/**
 * Creates the EVM strategy when wagmi bridge is present.
 * Delegates to bridge for account, chain, connectors, and switchChain.
 *
 * @param bridge - Wagmi bridge context value
 * @param connectors - Mapped connector props for the UI
 */
export function createEthereumBridgeStrategy(
  bridge: OpenfortEthereumBridgeValue,
  connectors: ExternalConnectorProps[]
): ConnectionStrategy {
  // Closure-level: survives strategy recreation via useMemo but is instance-scoped.
  // Module-level vars would leak across multiple CoreOpenfortProvider instances (e.g. tests).
  let lastInitChainId: number | undefined

  return {
    kind: 'bridge',
    chainType: ChainTypeEnum.EVM,

    isConnected(state) {
      return !!(bridge.account.isConnected && bridge.account.address && state.user)
    },

    getChainId() {
      return bridge.chainId
    },

    getAddress() {
      return bridge.account.address ?? undefined
    },

    getConnectRoutes() {
      return ['embedded', 'external-wallets']
    },

    getConnectors() {
      return connectors
    },

    async initProvider(
      openfort: Openfort,
      walletConfig: OpenfortWalletConfig,
      chainIdOverride?: number,
      activeEmbeddedAddress?: string
    ) {
      const chainId = chainIdOverride ?? bridge.chainId
      const feeSponsorshipObj = chainId != null ? resolveEthereumFeeSponsorship(walletConfig, chainId) : undefined

      const rpcUrls = bridge.config.chains.reduce(
        (acc, ch) => {
          const url = bridge.config.getClient({ chainId: ch.id }).transport?.url
          if (url) acc[ch.id] = url
          return acc
        },
        {} as Record<number, string>
      )

      const provider = await openfort.embeddedWallet.getEthereumProvider({
        ...feeSponsorshipObj,
        chains: rpcUrls,
        announceProvider: true,
        providerInfo: {
          name: 'Openfort',
          rdns: 'xyz.openfort',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        },
      })
      // Tell the provider which chain is active (EIP-1193). Keeps provider in sync with wagmi.
      // Skip if the chain hasn't changed since last init to avoid spurious 422s.
      // Skip if no active embedded account: openfort-js sends `account: null` to
      // /v2/accounts/switch-chain → 422. eth_accounts isn't a reliable proxy here —
      // it returns the signer address even when the active account isn't set yet.
      if (chainId != null && chainId !== lastInitChainId && activeEmbeddedAddress) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          })
          lastInitChainId = chainId
        } catch (switchErr) {
          logger.warn('[@openfort/react] wallet_switchEthereumChain failed — provider may be on wrong chain', switchErr)
        }
      }
    },

    async disconnect(openfort: Openfort) {
      lastInitChainId = undefined
      await bridge.disconnect()
      await openfort.auth.logout()
    },
  }
}
