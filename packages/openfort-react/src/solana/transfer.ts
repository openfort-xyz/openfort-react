'use client'

/**
 * Solana SOL transfer helpers.
 *
 * Builds, signs, and broadcasts a native SOL transfer with `@solana/kit`, signing
 * the message bytes through the embedded wallet provider (Ed25519). Mirrors the
 * documented `createOpenfortSigner` pattern. `@solana/kit`, `@solana-program/system`,
 * and `@solana/kora` are loaded lazily so the EVM bundle and the kit `^2 || ^5`
 * range stay untouched — only a Solana send pulls them in at runtime.
 */

import type { Address, SignatureBytes, SignatureDictionary, TransactionSigner } from '@solana/kit'
import type { OpenfortEmbeddedSolanaWalletProvider, SolanaCluster } from './types'

/** The System program id — the "token" for a native SOL transfer through Kora. */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111'
const SEND_TIMEOUT_MS = 60_000

/** Decimal SOL → lamports, without floating-point loss. */
export function solToLamports(amountSol: number): bigint {
  const [whole, frac = ''] = amountSol.toString().split('.')
  const padded = (frac + '0'.repeat(9)).slice(0, 9)
  return BigInt(`${whole || '0'}${padded}`)
}

/** Ed25519 signatures are 64 bytes; trim a trailing recovery byte if one is present. */
function toEd25519Signature(raw: Uint8Array): SignatureBytes {
  const trimmed = raw.length === 65 ? raw.slice(0, 64) : raw
  if (trimmed.length !== 64) {
    throw new Error(`Invalid Ed25519 signature: expected 64 bytes, got ${trimmed.length}`)
  }
  return trimmed as SignatureBytes
}

/** Solana confirmation needs a wss endpoint; public cluster RPCs serve one at the same host. */
function deriveWssUrl(rpcUrl: string): string {
  return rpcUrl.replace(/^https?:\/\//, 'wss://')
}

export type SendSolParams = {
  from: string
  to: string
  amountSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  rpcUrl: string
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

/**
 * Build, sign, and broadcast a native SOL transfer. Returns the transaction
 * signature (base58). The wallet pays the network fee — use {@link sendSolGasless}
 * to sponsor it.
 */
export async function sendSol({
  from,
  to,
  amountSol,
  provider,
  rpcUrl,
  commitment = 'confirmed',
}: SendSolParams): Promise<string> {
  const kit = await import('@solana/kit')
  const { getTransferSolInstruction } = await import('@solana-program/system')

  const fromAddress = kit.address(from)
  const rpc = kit.createSolanaRpc(rpcUrl)
  const rpcSubscriptions = kit.createSolanaRpcSubscriptions(deriveWssUrl(rpcUrl))

  const signer: TransactionSigner = {
    address: fromAddress,
    signTransactions: async (transactions): Promise<readonly SignatureDictionary[]> =>
      Promise.all(
        transactions.map(async (transaction) => {
          const { signature } = await provider.signTransaction({
            messageBytes: new Uint8Array(transaction.messageBytes),
          })
          const bytes = toEd25519Signature(new Uint8Array(kit.getBase58Encoder().encode(signature)))
          return Object.freeze({ [fromAddress]: bytes })
        })
      ),
  }

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayer(fromAddress, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      kit.appendTransactionMessageInstruction(
        getTransferSolInstruction({
          source: signer,
          destination: kit.address(to),
          amount: kit.lamports(solToLamports(amountSol)),
        }),
        tx
      )
  )

  const signedTransaction = await kit.signTransactionMessageWithSigners(message)

  const sendAndConfirm = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SEND_TIMEOUT_MS)
  try {
    await sendAndConfirm(signedTransaction as Parameters<typeof sendAndConfirm>[0], {
      commitment,
      abortSignal: abortController.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  return kit.getSignatureFromTransaction(signedTransaction)
}

export type SendSolGaslessParams = {
  from: string
  to: string
  amountSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  /** Project publishable key; sent to the Openfort Solana paymaster (Kora) as a Bearer token. */
  publishableKey: string
}

/** The Openfort Solana paymaster (Kora) endpoint for a cluster. */
function koraRpcUrl(cluster: SolanaCluster): string {
  const segment = cluster === 'mainnet-beta' ? 'mainnet' : cluster
  return `https://api.openfort.io/rpc/solana/${segment}`
}

/**
 * Send a native SOL transfer with fees sponsored by the Openfort Solana paymaster
 * (Kora): Kora is the fee payer, the user signs their part with the embedded wallet,
 * and Kora co-signs + broadcasts. Requires a `sponsorSolTransaction` policy on the
 * project. Returns the transaction signature (base58).
 */
export async function sendSolGasless({
  from,
  to,
  amountSol,
  provider,
  cluster,
  publishableKey,
}: SendSolGaslessParams): Promise<string> {
  const kit = await import('@solana/kit')
  const { KoraClient } = await import('@solana/kora')

  const client = new KoraClient({ rpcUrl: koraRpcUrl(cluster), apiKey: `Bearer ${publishableKey}` })

  // 1. Kora's fee-payer signer.
  const { signer_address } = await client.getPayerSigner()
  const feePayer = kit.createNoopSigner(signer_address as Address)

  // 2. A sponsored native SOL transfer, with Kora as the fee payer.
  const { instructions } = await client.transferTransaction({
    amount: Number(solToLamports(amountSol)),
    token: SYSTEM_PROGRAM_ID,
    source: from,
    destination: to,
    signer_key: signer_address,
  })

  // 3. Build the message with Kora as fee payer.
  const { blockhash } = await client.getBlockhash()
  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) =>
      kit.setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash as Parameters<typeof kit.setTransactionMessageLifetimeUsingBlockhash>[0]['blockhash'],
          lastValidBlockHeight: BigInt(0),
        },
        tx
      ),
    (tx) => kit.appendTransactionMessageInstructions(instructions, tx)
  )

  // 4. Inject the user's Ed25519 signature alongside Kora's placeholder.
  const partiallySigned = await kit.partiallySignTransactionMessageWithSigners(message)
  const { signature } = await provider.signTransaction(new Uint8Array(partiallySigned.messageBytes))
  const userSigned = {
    ...partiallySigned,
    signatures: {
      ...partiallySigned.signatures,
      [from]: toEd25519Signature(new Uint8Array(kit.getBase58Encoder().encode(signature))),
    },
  }
  const wire = kit.getBase64EncodedWireTransaction(userSigned)

  // 5. Kora co-signs (as fee payer) and broadcasts.
  const response = (await client.signAndSendTransaction({
    transaction: wire,
    signer_key: signer_address,
  })) as unknown as Record<string, unknown>

  const direct = response.signature as string | undefined
  if (direct) return direct
  const signedTxB64 = response.signed_transaction as string | undefined
  if (signedTxB64) {
    // Wire format: [sigCount(1)][signature(64)]... — the first signature is the tx id.
    const wireBytes = Uint8Array.from(atob(signedTxB64), (c) => c.charCodeAt(0))
    return kit.getBase58Decoder().decode(wireBytes.slice(1, 65))
  }
  throw new Error('Failed to extract transaction signature from the Kora response')
}
