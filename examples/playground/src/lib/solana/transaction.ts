import type { OpenfortEmbeddedSolanaWalletProvider } from '@openfort/react/solana'
import {
  type Address,
  appendTransactionMessageInstruction,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  lamports,
  pipe,
  type SignatureBytes,
  type SignatureDictionary,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from '@solana/kit'
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from '@solana-program/compute-budget'
import { getTransferSolInstruction } from '@solana-program/system'
import { Base58 } from 'ox'

const COMPUTE_UNIT_LIMIT = 200_000
const COMPUTE_UNIT_PRICE = 50_000n // microlamports

interface SendTransactionParams {
  from: Address
  to: Address
  amountInSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  rpcUrl?: string
}

interface TransactionResult {
  signature: string
}

/** Convert a decimal amount to the smallest unit (e.g. SOL to lamports) without floating-point loss */
function toSmallestUnit(amount: number, decimals: number): bigint {
  const str = amount.toString()
  const [whole, frac = ''] = str.split('.')
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole + padded)
}

/** Validate that the signature is a 64-byte Ed25519 signature */
function validateEd25519Signature(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) {
    throw new Error(`Invalid Ed25519 signature: expected 64 bytes, got ${raw.length}`)
  }
  return raw
}

/** Extract the fee payer's signature from the signed transaction */
function getTransactionSignature(signatures: Record<string, SignatureBytes | null>, feePayer: Address): string {
  const sig = signatures[feePayer]
  if (!sig) {
    throw new Error(`Fee payer signature not found for address: ${feePayer}`)
  }
  return Base58.fromBytes(sig)
}

function deriveWssUrl(rpcUrl: string): string {
  try {
    const parsed = new URL(rpcUrl)
    const hostname = parsed.hostname
    if (hostname === 'openfort.io' || hostname.endsWith('.openfort.io')) {
      return 'wss://api.devnet.solana.com'
    }
  } catch {
    // fall through
  }
  return rpcUrl.replace(/^https?:\/\//, 'wss://')
}

function createProviderSigner(
  signerAddress: Address,
  provider: OpenfortEmbeddedSolanaWalletProvider
): TransactionSigner {
  return {
    address: signerAddress,
    signTransactions: async (transactions): Promise<readonly SignatureDictionary[]> => {
      return Promise.all(
        transactions.map(async (transaction) => {
          const result = await provider.signTransaction({
            messageBytes: new Uint8Array(transaction.messageBytes),
          })
          const signatureBytes = validateEd25519Signature(Base58.toBytes(result.signature))
          return Object.freeze({
            [signerAddress]: signatureBytes as SignatureBytes,
          })
        })
      )
    },
  }
}

export async function sendSolTransaction({
  from,
  to,
  amountInSol,
  provider,
  rpcUrl,
}: SendTransactionParams): Promise<TransactionResult> {
  const httpUrl = rpcUrl ?? 'https://api.devnet.solana.com'
  const rpc = createSolanaRpc(httpUrl)
  const rpcSubscriptions = createSolanaRpcSubscriptions(deriveWssUrl(httpUrl))

  const signer = createProviderSigner(from, provider)
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(from, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(getSetComputeUnitLimitInstruction({ units: COMPUTE_UNIT_LIMIT }), tx),
    (tx) =>
      appendTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: COMPUTE_UNIT_PRICE }), tx),
    (tx) =>
      appendTransactionMessageInstruction(
        getTransferSolInstruction({
          source: signer,
          destination: to,
          amount: lamports(toSmallestUnit(amountInSol, 9)),
        }),
        tx
      )
  )

  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
  assertIsTransactionWithBlockhashLifetime(signedTransaction)

  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 60_000)
  try {
    await sendAndConfirmTransaction(signedTransaction, {
      commitment: 'confirmed',
      abortSignal: abortController.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  return { signature: getTransactionSignature(signedTransaction.signatures, from) }
}
