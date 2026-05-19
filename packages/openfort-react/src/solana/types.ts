/**
 * Solana-specific types for @openfort/react/solana
 *
 * These types define the Solana wallet state machine and related interfaces.
 */

import type { ChainTypeEnum, EmbeddedAccount, RecoveryMethod, RecoveryParams } from '@openfort/openfort-js'
import type React from 'react'
import type {
  ConnectedWalletState,
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetActiveEmbeddedWalletOptionsBase,
  SetRecoveryOptions as SetRecoveryOptionsBase,
  WalletDerived,
} from '../shared/types'

/**
 * Solana cluster identifier
 */
export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet'

/**
 * Solana commitment level for transactions
 */
export type SolanaCommitment = 'processed' | 'confirmed' | 'finalized'

/**
 * UI options for Solana-connected views (e.g. SolanaConnected page)
 */
export type SolanaUIOptions = {
  /** Custom avatar component; receives address for display */
  customAvatar?: React.ComponentType<{ address: string }>
}

/**
 * Configuration for Solana support in OpenfortProvider
 *
 * @example
 * ```tsx
 * <OpenfortProvider
 *   publishableKey="pk_..."
 *   walletConfig={{
 *     shieldPublishableKey: 'shield_pk_...',
 *     solana: {
 *       cluster: 'mainnet-beta',
 *       commitment: 'confirmed'
 *     }
 *   }}
 * >
 * ```
 */
export type SolanaConfig = {
  /** Solana cluster to connect to */
  cluster: SolanaCluster
  /** RPC URLs per cluster (mirrors ethereum.rpcUrls) */
  rpcUrls?: Partial<Record<'mainnet-beta' | 'devnet' | 'testnet', string>>
  /** Commitment level for transactions (default: 'confirmed') */
  commitment?: SolanaCommitment
  /** UI options for Solana-connected screens */
  ui?: SolanaUIOptions
}

/**
 * Solana transaction formats supported by the provider
 *
 * Supports both @solana/kit format and raw bytes.
 */
export type SolanaTransaction =
  | { messageBytes: Uint8Array } // @solana/kit format
  | { serializeMessage(): Uint8Array } // @solana/web3.js Transaction
  | Uint8Array // Raw bytes

/**
 * Signed Solana transaction result
 */
export type SignedSolanaTransaction = {
  /** Base58 encoded signature */
  signature: string
  /** Base58 encoded public key of signer */
  publicKey: string
}

/**
 * Request to sign a message
 */
export type SolanaSignMessageRequest = {
  method: 'signMessage'
  params: { message: string }
}

/**
 * Request to sign a transaction
 */
export type SolanaSignTransactionRequest = {
  method: 'signTransaction'
  params: { transaction: SolanaTransaction }
}

/**
 * Request to sign multiple transactions
 */
export type SolanaSignAllTransactionsRequest = {
  method: 'signAllTransactions'
  params: { transactions: SolanaTransaction[] }
}

/**
 * Solana embedded wallet provider
 *
 * Provides signing capabilities for Solana transactions and messages.
 * Can be used directly or wrapped with Kit signers.
 *
 * @example Direct usage
 * ```tsx
 * if (solana.status === 'connected') {
 *   const signature = await solana.provider.signMessage('Hello Solana!');
 * }
 * ```
 *
 * @example With Kit Signer (from @openfort/react/solana)
 * ```tsx
 * const signer = createTransactionSigner(provider);
 * // Use with @solana/kit
 * ```
 */
export interface OpenfortEmbeddedSolanaWalletProvider {
  /** Public key of the wallet (Base58 encoded) */
  readonly publicKey: string

  /**
   * Sign a message
   * @param message - Message to sign (UTF-8 string)
   * @returns Base58 encoded signature
   */
  signMessage(message: string): Promise<string>

  /**
   * Sign a single transaction
   * @param transaction - Transaction to sign
   * @returns Signed transaction with signature and public key
   */
  signTransaction(transaction: SolanaTransaction): Promise<SignedSolanaTransaction>

  /**
   * Sign multiple transactions atomically
   * @param transactions - Array of transactions to sign
   * @returns Array of signed transactions
   */
  signAllTransactions(transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]>

  /**
   * Request-based API (EIP-1193 style)
   */
  request(args: SolanaSignMessageRequest): Promise<{ signature: string }>
  request(args: SolanaSignTransactionRequest): Promise<{ signedTransaction: SignedSolanaTransaction }>
  request(args: SolanaSignAllTransactionsRequest): Promise<{ signedTransactions: SignedSolanaTransaction[] }>
}

/**
 * Connected Solana embedded wallet
 */
export type ConnectedEmbeddedSolanaWallet = {
  /** Embedded account id (from Openfort) */
  id: string
  /** Solana address in Base58 format */
  address: string
  /** Chain type discriminator */
  chainType: typeof ChainTypeEnum.SVM
  /** Wallet index (for multiple wallets) */
  walletIndex: number
  /** Recovery method for this wallet */
  recoveryMethod?: RecoveryMethod
  /** Get the Solana wallet provider */
  getProvider(): Promise<OpenfortEmbeddedSolanaWalletProvider>
}

/** Options for setting active Solana wallet (chain-specific address + shared recovery). */
export type SetActiveSolanaWalletOptions = SetActiveEmbeddedWalletOptionsBase & {
  /** Wallet address to set as active (Base58) */
  address: string
}

/**
 * Actions available on Solana embedded wallets
 */
export interface SolanaWalletActions {
  /** Create a new Solana embedded wallet */
  create(options?: CreateEmbeddedWalletOptions): Promise<EmbeddedAccount>
  /** Import a Solana embedded wallet from a base58-encoded secret key */
  import(options: ImportEmbeddedWalletOptions): Promise<EmbeddedAccount>
  /** List of available Solana wallets */
  wallets: ConnectedEmbeddedSolanaWallet[]
  /** Set the active wallet */
  setActive(options: SetActiveSolanaWalletOptions): Promise<void>
  /** Update recovery method */
  setRecovery(options: SetRecoveryOptionsBase): Promise<void>
  /** Export the private key (requires user confirmation) */
  exportPrivateKey(): Promise<string>
}

export type SolanaWalletStateBase =
  | (SolanaWalletActions & {
      status: 'disconnected'
      activeWallet: null
      address?: never
      cluster?: never
      displayAddress?: never
    })
  | (SolanaWalletActions & {
      status: 'fetching-wallets'
      activeWallet: null
      address?: never
      cluster?: never
      displayAddress?: never
    })
  | (SolanaWalletActions & {
      status: 'connecting'
      activeWallet: ConnectedEmbeddedSolanaWallet
      address: string
      cluster: SolanaCluster
      displayAddress: string
    })
  | (SolanaWalletActions & {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedSolanaWallet
      address: string
      cluster: SolanaCluster
      displayAddress: string
    })
  | (SolanaWalletActions & {
      status: 'creating'
      activeWallet: null
      address?: never
      cluster?: never
      displayAddress?: never
    })
  | (SolanaWalletActions & {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedSolanaWallet
      address?: string
      cluster?: SolanaCluster
      displayAddress?: string
    })
  | (SolanaWalletActions & {
      status: 'connected'
      activeWallet: ConnectedEmbeddedSolanaWallet
      provider: OpenfortEmbeddedSolanaWalletProvider
      address: string
      cluster: SolanaCluster
      displayAddress: string
    })
  | (SolanaWalletActions & {
      status: 'error'
      activeWallet: ConnectedEmbeddedSolanaWallet | null
      error: string
      address?: string
      cluster?: SolanaCluster
      displayAddress?: string
    })

/** Derived booleans + optional RPC URL (Solana-specific). */
export type SolanaWalletDerived = WalletDerived & { rpcUrl?: string }

export type SolanaWalletState = SolanaWalletStateBase & SolanaWalletDerived & ConnectedWalletState

/**
 * Options for useSolanaEmbeddedWallet hook
 */
export type UseEmbeddedSolanaWalletOptions = {
  /** Solana cluster (mainnet-beta, devnet, testnet). Overrides context when set. */
  cluster?: SolanaCluster
  /** Recovery params for wallet access */
  recoveryParams?: RecoveryParams
}
