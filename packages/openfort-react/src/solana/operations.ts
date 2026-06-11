/**
 * Solana Wallet Operations
 *
 * Pure functions for signing operations.
 * Extracted from hooks for testability and reusability.
 *
 * CRITICAL: Solana uses Ed25519, NOT keccak256.
 * Always set hashMessage: false when signing.
 */

import { OpenfortError, OpenfortReactErrorType } from '../core/errors'

import type { SolanaTransaction } from './types'

/**
 * Extract message bytes from various Solana transaction formats
 *
 * Supports:
 * - Raw Uint8Array
 * - Object with messageBytes property
 * - Object with serializeMessage() method (legacy Transaction)
 *
 * @param transaction - Transaction in various formats
 * @returns Transaction bytes as Uint8Array
 */
export function getTransactionBytes(transaction: SolanaTransaction): Uint8Array {
  // Raw bytes
  if (transaction instanceof Uint8Array) {
    return transaction
  }

  // Object with messageBytes (VersionedTransaction style)
  if ('messageBytes' in transaction) {
    return transaction.messageBytes
  }

  // Object with serializeMessage (legacy Transaction style)
  if ('serializeMessage' in transaction && typeof transaction.serializeMessage === 'function') {
    return transaction.serializeMessage()
  }

  throw new OpenfortError('Unsupported Solana transaction format', OpenfortReactErrorType.CONFIGURATION_ERROR)
}
