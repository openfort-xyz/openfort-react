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
export { useEthereumBalance } from './hooks/useEthereumBalance'
export { useEthereumEmbeddedWallet } from './hooks/useEthereumEmbeddedWallet'
export { useEthereumWalletAssets } from './hooks/useEthereumWalletAssets'
export { useSendTransaction } from './hooks/useSendTransaction'
export { useWriteContract } from './hooks/useWriteContract'
export type {
  ConnectedEmbeddedEthereumWallet,
  EthereumConfig,
  EthereumWalletActions,
  EthereumWalletState,
  FeeSponsorshipConfig,
  OpenfortEmbeddedEthereumWalletProvider,
  SendTransactionParams,
  SendTransactionResult,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
  UseEthereumBalanceOptions,
  UseEthereumBalanceResult,
  UseSendTransactionOptions,
  UseWriteContractResult,
  WriteContractParams,
} from './types'
