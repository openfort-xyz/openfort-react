/**
 * Solana-specific exports for @openfort/react/solana
 *
 * Import from '@openfort/react/solana' for Solana-only features.
 * Tree-shakeable: only imported Solana code will be bundled.
 *
 * @packageDocumentation
 */

export type { SolanaUserWallet } from '../hooks/openfort/walletTypes'
export type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
} from '../shared/types'
export { useSolanaEmbeddedWallet } from './hooks/useSolanaEmbeddedWallet'
export type {
  // Wallet types
  ConnectedEmbeddedSolanaWallet,
  // Provider types
  OpenfortEmbeddedSolanaWalletProvider,
  SetActiveSolanaWalletOptions,
  // Kit Signer types
  SignedSolanaTransaction,
  // Configuration
  SolanaCluster,
  SolanaCommitment,
  SolanaConfig,
  SolanaSignAllTransactionsRequest,
  SolanaSignMessageRequest,
  SolanaSignTransactionRequest,
  // Transaction types
  SolanaTransaction,
  SolanaWalletActions,
  SolanaWalletState,
  UseEmbeddedSolanaWalletOptions,
} from './types'
