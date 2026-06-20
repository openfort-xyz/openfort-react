'use client'

/**
 * Solana transfer helpers — native SOL and SPL tokens, each with an optional
 * sponsored (gasless) path through the Openfort paymaster (Kora).
 *
 * Builds, signs, and broadcasts with `@solana/kit`, signing the message bytes
 * through the embedded wallet provider (Ed25519). Mirrors the documented
 * `createOpenfortSigner` pattern. `@solana/kit`, `@solana-program/system`,
 * `@solana-program/token`, and `@solana/kora` are loaded lazily so the EVM
 * bundle and the kit `^2 || ^5` range stay untouched — only a Solana send pulls
 * them in at runtime.
 */

import type { Address, SignatureBytes, SignatureDictionary, TransactionSigner } from '@solana/kit'
import type { OpenfortEmbeddedSolanaWalletProvider, SolanaCluster } from './types'

type Kit = typeof import('@solana/kit')

/** The System program id — the "token" for a native SOL transfer through Kora. */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111'
const SEND_TIMEOUT_MS = 60_000

/** Decimal SOL → lamports, without floating-point loss. */
function solToLamports(amountSol: number): bigint {
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

/**
 * A `TransactionSigner` that signs message bytes through the embedded wallet
 * provider (Ed25519). Shared by the native and SPL non-sponsored paths.
 */
function createEmbeddedSigner(
  kit: Kit,
  provider: OpenfortEmbeddedSolanaWalletProvider,
  fromAddress: Address
): TransactionSigner {
  return {
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
}

type SendSolParams = {
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
  const signer = createEmbeddedSigner(kit, provider, fromAddress)

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

type SendSplTokenParams = {
  from: string
  to: string
  /** SPL mint address (base58). */
  mint: string
  /** Amount in token base units (already scaled by `decimals`). */
  amount: bigint
  decimals: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  rpcUrl: string
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

/**
 * Build, sign, and broadcast an SPL token transfer. Creates the recipient's
 * associated token account if it doesn't exist yet (idempotent — a no-op when it
 * already holds the token; the sender pays the small rent). The wallet pays the
 * network fee — use {@link sendSplTokenGasless} to sponsor it. Returns the
 * transaction signature (base58).
 */
export async function sendSplToken({
  from,
  to,
  mint,
  amount,
  decimals,
  provider,
  rpcUrl,
  commitment = 'confirmed',
}: SendSplTokenParams): Promise<string> {
  const kit = await import('@solana/kit')
  const token = await import('@solana-program/token')

  const fromAddress = kit.address(from)
  const toAddress = kit.address(to)
  const mintAddress = kit.address(mint)
  const rpc = kit.createSolanaRpc(rpcUrl)
  const rpcSubscriptions = kit.createSolanaRpcSubscriptions(deriveWssUrl(rpcUrl))
  const signer = createEmbeddedSigner(kit, provider, fromAddress)

  const [sourceAta] = await token.findAssociatedTokenPda({
    owner: fromAddress,
    tokenProgram: token.TOKEN_PROGRAM_ADDRESS,
    mint: mintAddress,
  })
  const [destinationAta] = await token.findAssociatedTokenPda({
    owner: toAddress,
    tokenProgram: token.TOKEN_PROGRAM_ADDRESS,
    mint: mintAddress,
  })

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayer(fromAddress, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      kit.appendTransactionMessageInstructions(
        [
          token.getCreateAssociatedTokenIdempotentInstruction({
            payer: signer,
            ata: destinationAta,
            owner: toAddress,
            mint: mintAddress,
          }),
          token.getTransferCheckedInstruction({
            source: sourceAta,
            mint: mintAddress,
            destination: destinationAta,
            authority: signer,
            amount,
            decimals,
          }),
        ],
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

/** The Openfort Solana paymaster (Kora) endpoint for a cluster. */
function koraRpcUrl(cluster: SolanaCluster): string {
  const segment = cluster === 'mainnet-beta' ? 'mainnet' : cluster
  return `https://api.openfort.io/rpc/solana/${segment}`
}

type KoraTransferParams = {
  from: string
  to: string
  /** Amount in base units — lamports for SOL, token base units for an SPL mint. */
  amountBaseUnits: bigint
  /** System program id for native SOL, or the SPL mint address. */
  token: string
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  publishableKey: string
}

/**
 * Sponsor a transfer through the Openfort Solana paymaster (Kora): Kora is the
 * fee payer, the user signs their part with the embedded wallet, and Kora
 * co-signs + broadcasts. Requires a `sponsorSolTransaction` policy on the
 * project. Returns the transaction signature (base58).
 */
async function sendViaKora({
  from,
  to,
  amountBaseUnits,
  token,
  provider,
  cluster,
  publishableKey,
}: KoraTransferParams): Promise<string> {
  const kit = await import('@solana/kit')
  const { KoraClient } = await import('@solana/kora')

  const client = new KoraClient({ rpcUrl: koraRpcUrl(cluster), apiKey: `Bearer ${publishableKey}` })

  // 1. Kora's fee-payer signer.
  const { signer_address } = await client.getPayerSigner()
  const feePayer = kit.createNoopSigner(signer_address as Address)

  // 2. A sponsored transfer (native or SPL), with Kora as the fee payer.
  const { instructions } = await client.transferTransaction({
    amount: Number(amountBaseUnits),
    token,
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

type SendSolGaslessParams = {
  from: string
  to: string
  amountSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  /** Project publishable key; sent to the Openfort Solana paymaster (Kora) as a Bearer token. */
  publishableKey: string
}

/** Send a native SOL transfer with fees sponsored by the Openfort paymaster (Kora). */
export async function sendSolGasless({
  from,
  to,
  amountSol,
  provider,
  cluster,
  publishableKey,
}: SendSolGaslessParams): Promise<string> {
  return sendViaKora({
    from,
    to,
    amountBaseUnits: solToLamports(amountSol),
    token: SYSTEM_PROGRAM_ID,
    provider,
    cluster,
    publishableKey,
  })
}

type SendSplTokenGaslessParams = {
  from: string
  to: string
  /** SPL mint address (base58). */
  mint: string
  /** Amount in token base units (already scaled by `decimals`). */
  amount: bigint
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  /** Project publishable key; sent to the Openfort Solana paymaster (Kora) as a Bearer token. */
  publishableKey: string
}

/** Send an SPL token transfer with fees sponsored by the Openfort paymaster (Kora). */
export async function sendSplTokenGasless({
  from,
  to,
  mint,
  amount,
  provider,
  cluster,
  publishableKey,
}: SendSplTokenGaslessParams): Promise<string> {
  return sendViaKora({
    from,
    to,
    amountBaseUnits: amount,
    token: mint,
    provider,
    cluster,
    publishableKey,
  })
}
