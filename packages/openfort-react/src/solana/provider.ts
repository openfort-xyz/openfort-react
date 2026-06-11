/**
 * Solana Wallet Provider Implementation
 *
 * Provides signing capabilities for Solana transactions and messages.
 * This provider implements a request-based API pattern similar to EIP-1193
 * but adapted for Solana operations.
 *
 * CRITICAL: Ed25519 signing is used for Solana (no keccak256 hashing).
 * When calling the Openfort SDK, always use hashMessage: false.
 */

import type { EmbeddedAccount } from '@openfort/openfort-js'
import type {
  OpenfortEmbeddedSolanaWalletProvider,
  SignedSolanaTransaction,
  SolanaSignAllTransactionsRequest,
  SolanaSignMessageRequest,
  SolanaSignTransactionRequest,
  SolanaTransaction,
} from './types'

// Union type for all request arguments
type SolanaRequestArguments = SolanaSignMessageRequest | SolanaSignTransactionRequest | SolanaSignAllTransactionsRequest

/**
 * Configuration for creating an OpenfortSolanaProvider
 */
interface OpenfortSolanaProviderConfig {
  /** The embedded account to use for this provider */
  account: EmbeddedAccount
  /**
   * Function to sign a single transaction.
   * Should use hashMessage: false for Ed25519 signing.
   */
  signTransaction: (transaction: SolanaTransaction) => Promise<SignedSolanaTransaction>
  /**
   * Function to sign multiple transactions.
   * Should use hashMessage: false for Ed25519 signing.
   */
  signAllTransactions: (transactions: SolanaTransaction[]) => Promise<SignedSolanaTransaction[]>
  /**
   * Function to sign a message.
   * CRITICAL: Must use hashMessage: false for Ed25519 (no keccak256).
   */
  signMessage: (message: string) => Promise<string>
}

/**
 * Embedded Solana wallet provider implementation for Openfort.
 *
 * This provider can be used directly for signing operations or wrapped
 * with Kit signers for use with @solana/kit.
 *
 * @example Direct usage
 * ```ts
 * const signature = await provider.signMessage('Hello Solana!');
 * const signed = await provider.signTransaction(transaction);
 * ```
 *
 * @example Request-based API
 * ```ts
 * const { signature } = await provider.request({
 *   method: 'signMessage',
 *   params: { message: 'Hello Solana!' }
 * });
 * ```
 */
class OpenfortSolanaProvider implements OpenfortEmbeddedSolanaWalletProvider {
  private readonly _account: EmbeddedAccount
  private readonly _signTransaction: (transaction: SolanaTransaction) => Promise<SignedSolanaTransaction>
  private readonly _signAllTransactions: (transactions: SolanaTransaction[]) => Promise<SignedSolanaTransaction[]>
  private readonly _signMessage: (message: string) => Promise<string>

  /**
   * Creates a new OpenfortSolanaProvider instance
   *
   * @param config - Provider configuration including account and signing functions
   */
  constructor(config: OpenfortSolanaProviderConfig) {
    this._account = config.account
    this._signTransaction = config.signTransaction
    this._signAllTransactions = config.signAllTransactions
    this._signMessage = config.signMessage
  }

  /**
   * The public key of the wallet (Solana address in Base58 format)
   */
  get publicKey(): string {
    return this._account.address
  }

  /**
   * Sign a message
   *
   * @param message - Message to sign (UTF-8 string)
   * @returns Base58 encoded signature
   */
  async signMessage(message: string): Promise<string> {
    return await this._signMessage(message)
  }

  /**
   * Sign a single transaction
   *
   * @param transaction - Transaction to sign (various formats supported)
   * @returns Signed transaction with signature and public key
   */
  async signTransaction(transaction: SolanaTransaction): Promise<SignedSolanaTransaction> {
    return await this._signTransaction(transaction)
  }

  /**
   * Sign multiple transactions atomically
   *
   * @param transactions - Array of transactions to sign
   * @returns Array of signed transactions in the same order
   */
  async signAllTransactions(transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]> {
    return await this._signAllTransactions(transactions)
  }

  /**
   * Request-based API for wallet operations
   *
   * Provides a unified interface similar to EIP-1193 but for Solana operations.
   */
  request(args: SolanaSignMessageRequest): Promise<{ signature: string }>
  request(args: SolanaSignTransactionRequest): Promise<{ signedTransaction: SignedSolanaTransaction }>
  request(args: SolanaSignAllTransactionsRequest): Promise<{ signedTransactions: SignedSolanaTransaction[] }>
  async request(
    args: SolanaRequestArguments
  ): Promise<
    | { signature: string }
    | { signedTransaction: SignedSolanaTransaction }
    | { signedTransactions: SignedSolanaTransaction[] }
  > {
    switch (args.method) {
      case 'signMessage': {
        const signature = await this._signMessage(args.params.message)
        return { signature }
      }
      case 'signTransaction': {
        const signedTransaction = await this._signTransaction(args.params.transaction)
        return { signedTransaction }
      }
      case 'signAllTransactions': {
        const signedTransactions = await this._signAllTransactions(args.params.transactions)
        return { signedTransactions }
      }
    }
  }

  /**
   * Pretty log output for when an instance of this class is console.log'd
   */
  toJSON(): string {
    return `OpenfortSolanaProvider(${this.publicKey})`
  }

  /**
   * String representation
   */
  toString(): string {
    return this.toJSON()
  }
}

/**
 * Creates a new OpenfortSolanaProvider instance
 *
 * @param config - Provider configuration
 * @returns A new OpenfortSolanaProvider instance
 *
 * @example
 * ```ts
 * const provider = createSolanaProvider({
 *   account: embeddedAccount,
 *   signTransaction: async (tx) => { ... },
 *   signAllTransactions: async (txs) => { ... },
 *   signMessage: async (msg) => { ... },
 * });
 * ```
 */
export function createSolanaProvider(config: OpenfortSolanaProviderConfig): OpenfortSolanaProvider {
  return new OpenfortSolanaProvider(config)
}
