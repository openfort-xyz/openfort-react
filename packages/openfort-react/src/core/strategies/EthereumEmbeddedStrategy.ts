import { ChainTypeEnum, EmbeddedState, type Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import type { EmbeddedSignerOperationContext } from '../../shared/utils/embeddedSignerOperationQueue.js'
import { logger } from '../../utils/logger.js'
import type { ConnectionStrategy, ConnectionStrategyState } from '../ConnectionStrategy.js'
import { DEFAULT_DEV_CHAIN_ID } from '../ConnectionStrategy.js'
import { firstEmbeddedAddress, resolveEthereumFeeSponsorship } from '../strategyUtils.js'
import { commitEthereumProviderConfiguration } from './ethereumProviderInitialization.js'

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

    getConnectors() {
      return []
    },

    async initProvider(
      openfort: Openfort,
      config: OpenfortWalletConfig,
      chainIdOverride: number | undefined,
      { assertCurrent }: EmbeddedSignerOperationContext
    ) {
      const ethereum = config?.ethereum
      const chainId = chainIdOverride ?? ethereum?.chainId ?? DEFAULT_DEV_CHAIN_ID
      const rpcUrls = ethereum?.rpcUrls ?? {}
      const feeSponsorship = resolveEthereumFeeSponsorship(config, chainId)

      const provider = await openfort.embeddedWallet.getEthereumProvider({
        chains: rpcUrls,
        announceProvider: false,
      })
      assertCurrent()
      commitEthereumProviderConfiguration({
        provider,
        feeSponsorship,
        assertCurrent,
      })
      assertCurrent()
      // Tell the provider which chain is active (EIP-1193). Without this, the provider
      // stays on its initial chain (e.g. 80002) while fee sponsorship resolution is per-chain.
      // Real iframe-state check: throws when Account.fromStorage is empty (signer not yet
      // configured by configure/create/recover). Avoids spurious /v2/accounts/switch-chain
      // calls (422 with account=null) and redundant calls when already on target chain.
      if (chainId === lastInitChainId) return
      const wallet = await openfort.embeddedWallet.get().catch(() => null)
      assertCurrent()
      if (!wallet?.address || wallet.chainId === chainId) return
      assertCurrent()
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        })
      } catch (switchErr) {
        assertCurrent()
        logger.warn('[@openfort/react] wallet_switchEthereumChain failed — provider may be on wrong chain', switchErr)
        return
      }
      assertCurrent()
      lastInitChainId = chainId
    },

    async disconnect(openfort: Openfort) {
      lastInitChainId = undefined
      await openfort.auth.logout()
    },
  }
}
