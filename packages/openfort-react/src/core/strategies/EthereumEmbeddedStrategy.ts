import { ChainTypeEnum, EmbeddedState, type Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types'
import { logger } from '../../utils/logger'
import type { ConnectionStrategy, ConnectionStrategyState } from '../ConnectionStrategy'
import { DEFAULT_DEV_CHAIN_ID } from '../ConnectionStrategy'
import { firstEmbeddedAddress, resolveEthereumFeeSponsorship } from '../strategyUtils'

function hasEmbeddedEthereum(state: ConnectionStrategyState): boolean {
  if (!state.user || !state.activeEmbeddedAddress || state.embeddedState !== EmbeddedState.READY) return false
  return (
    state.embeddedAccounts?.some(
      (a) => a.chainType === ChainTypeEnum.EVM && a.address === state.activeEmbeddedAddress
    ) ?? false
  )
}

/**
 * Creates the EVM embedded strategy for SDK-only mode (no wagmi).
 *
 * @param walletConfig - Wallet config with ethereum.chainId and rpcUrls
 */
export function createEthereumEmbeddedStrategy(walletConfig: OpenfortWalletConfig | undefined): ConnectionStrategy {
  // Closure-level: survives strategy recreation via useMemo but is instance-scoped.
  // Module-level vars would leak across multiple CoreOpenfortProvider instances (e.g. tests).
  let lastInitChainId: number | undefined

  const chainId = walletConfig?.ethereum?.chainId
  const effectiveChainId =
    chainId ??
    (() => {
      logger.warn(
        '[@openfort/react] EVM without Wagmi: no walletConfig.ethereum.chainId. Using development chain default (Sepolia). Set walletConfig.ethereum.chainId for production.'
      )
      return DEFAULT_DEV_CHAIN_ID
    })()

  return {
    kind: 'embedded',
    chainType: ChainTypeEnum.EVM,

    isConnected(state) {
      return hasEmbeddedEthereum(state)
    },

    getChainId() {
      return effectiveChainId
    },

    getAddress(state) {
      if (state.activeEmbeddedAddress) return state.activeEmbeddedAddress
      return firstEmbeddedAddress(state.embeddedAccounts, ChainTypeEnum.EVM)
    },

    getConnectRoutes() {
      return ['embedded']
    },

    getConnectors() {
      return []
    },

    async initProvider(
      openfort: Openfort,
      config: OpenfortWalletConfig,
      chainIdOverride?: number,
      activeEmbeddedAddress?: string
    ) {
      const ethereum = config?.ethereum
      const chainId = chainIdOverride ?? ethereum?.chainId ?? DEFAULT_DEV_CHAIN_ID
      const rpcUrls = ethereum?.rpcUrls ?? {}
      const feeSponsorshipObj = resolveEthereumFeeSponsorship(config, chainId)

      const provider = await openfort.embeddedWallet.getEthereumProvider({
        ...feeSponsorshipObj,
        chains: rpcUrls,
      })
      // Tell the provider which chain is active (EIP-1193). Without this, the provider
      // stays on its initial chain (e.g. 80002) while fee sponsorship resolution is per-chain.
      // Skip if the chain hasn't changed since last init to avoid spurious 422s.
      // Skip if no active embedded account: openfort-js sends `account: null` to
      // /v2/accounts/switch-chain → 422. eth_accounts isn't a reliable proxy here —
      // it returns the signer address even when the active account isn't set yet.
      if (chainId !== lastInitChainId && activeEmbeddedAddress) {
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
      await openfort.auth.logout()
    },
  }
}
