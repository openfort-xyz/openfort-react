/**
 * @solana/kit signer adapter for the embedded Solana wallet.
 *
 * Wraps an {@link OpenfortEmbeddedSolanaWalletProvider} into a `@solana/kit` `TransactionSigner`
 * so it can be passed to `signTransactionMessageWithSigners`, `setTransactionMessageFeePayerSigner`,
 * and the rest of the kit transaction-building APIs. `@solana/kit` is loaded lazily so importing
 * this helper does not pull kit into bundles that do not use it.
 *
 * CRITICAL: Solana uses Ed25519 — the embedded provider signs message bytes directly (no hashing).
 */

import type { Address, SignatureBytes, SignatureDictionary, TransactionSigner } from '@solana/kit'
import type { OpenfortEmbeddedSolanaWalletProvider } from './types'

function assertEd25519Signature(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) {
    throw new Error(`Invalid Ed25519 signature: expected 64 bytes, got ${raw.length}`)
  }
  return raw
}

/**
 * Create a `@solana/kit` {@link TransactionSigner} backed by the embedded wallet provider.
 *
 * @example
 * ```ts
 * import { createSolanaSigner } from '@openfort/react/solana'
 * import { setTransactionMessageFeePayerSigner, signTransactionMessageWithSigners } from '@solana/kit'
 *
 * const signer = createSolanaSigner(solana.provider)
 * const message = setTransactionMessageFeePayerSigner(signer, baseMessage)
 * const signed = await signTransactionMessageWithSigners(message)
 * ```
 */
export function createSolanaSigner(provider: OpenfortEmbeddedSolanaWalletProvider): TransactionSigner {
  const address = provider.publicKey as Address
  return {
    address,
    signTransactions: async (transactions): Promise<readonly SignatureDictionary[]> => {
      const { getBase58Encoder } = await import('@solana/kit')
      const base58 = getBase58Encoder()
      return Promise.all(
        transactions.map(async (transaction) => {
          const { signature } = await provider.signTransaction({
            messageBytes: new Uint8Array(transaction.messageBytes),
          })
          const signatureBytes = assertEd25519Signature(new Uint8Array(base58.encode(signature)))
          return Object.freeze({ [address]: signatureBytes as SignatureBytes })
        })
      )
    },
  }
}
