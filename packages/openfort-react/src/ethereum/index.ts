/**
 * Ethereum-specific exports for @openfort/react/ethereum
 *
 * Import from '@openfort/react/ethereum' for Ethereum-only features.
 *
 * @packageDocumentation
 */

export type { BalanceState, UseBalanceOptions } from '../hooks/useBalance'
export { invalidateBalance, useBalance } from '../hooks/useBalance'
export type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
} from '../shared/types'
export { useEthereumEmbeddedWallet } from './hooks/useEthereumEmbeddedWallet'
export { useEthereumWalletAssets } from './hooks/useEthereumWalletAssets'
export type {
  ConnectedEmbeddedEthereumWallet,
  EthereumConfig,
  EthereumWalletActions,
  EthereumWalletState,
  FeeSponsorshipConfig,
  OpenfortEmbeddedEthereumWalletProvider,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
} from './types'
