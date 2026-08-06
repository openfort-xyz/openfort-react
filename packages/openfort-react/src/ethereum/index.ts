/**
 * Ethereum-specific exports for @openfort/react/ethereum
 *
 * Import from '@openfort/react/ethereum' for Ethereum-only features.
 *
 * @packageDocumentation
 */

export type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
} from '../shared/types.js'
export { useEthereumEmbeddedWallet } from './hooks/useEthereumEmbeddedWallet.js'
export { useEthereumWalletAssets } from './hooks/useEthereumWalletAssets.js'
export type {
  ConnectedEmbeddedEthereumWallet,
  EthereumConfig,
  EthereumWalletActions,
  EthereumWalletState,
  FeeSponsorshipConfig,
  OpenfortEmbeddedEthereumWalletProvider,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
} from './types.js'
