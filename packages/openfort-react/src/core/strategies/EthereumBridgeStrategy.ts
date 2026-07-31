import { ChainTypeEnum, type Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import type { OpenfortEthereumBridgeValue } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import { logger } from '../../utils/logger.js'
import type { ExternalConnectorProps } from '../../wallets/useExternalConnectors.js'
import type { ConnectionStrategy } from '../ConnectionStrategy.js'
import { resolveEthereumFeeSponsorship } from '../strategyUtils.js'

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

    getConnectors() {
      return connectors
    },

    async initProvider(openfort: Openfort, walletConfig: OpenfortWalletConfig, chainIdOverride?: number) {
      const chainId = chainIdOverride ?? bridge.chainId
      const feeSponsorshipObj = chainId != null ? resolveEthereumFeeSponsorship(walletConfig, chainId) : undefined

      // Per-chain RPC endpoints handed to the embedded signer. An explicitly
      // configured `walletConfig.ethereum.rpcUrls` entry wins over the wagmi
      // transport URL: the signer resolves these endpoints from its own context
      // (the Shield iframe), so an app can point wagmi's in-browser transports at
      // one node while keeping the signer on endpoints reachable from anywhere.
      const configuredRpcUrls = walletConfig.ethereum?.rpcUrls ?? {}
      const rpcUrls = bridge.config.chains.reduce(
        (acc, ch) => {
          const url = configuredRpcUrls[ch.id] ?? bridge.config.getClient({ chainId: ch.id }).transport?.url
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
      // Real iframe-state check: throws when Account.fromStorage is empty (signer not yet
      // configured by configure/create/recover). Avoids spurious /v2/accounts/switch-chain
      // calls (422 with account=null) and redundant calls when already on target chain.
      if (chainId == null || chainId === lastInitChainId) return
      const wallet = await openfort.embeddedWallet.get().catch(() => null)
      if (!wallet?.address || wallet.chainId === chainId) return
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        })
        lastInitChainId = chainId
      } catch (switchErr) {
        logger.warn('[@openfort/react] wallet_switchEthereumChain failed — provider may be on wrong chain', switchErr)
      }
    },

    async disconnect(openfort: Openfort) {
      lastInitChainId = undefined
      await bridge.disconnect()
      await openfort.auth.logout()
    },
  }
}
