'use client'

/**
 * Solana transfer helpers — native SOL and SPL tokens, each with an optional
 * sponsored (gasless) path through the Openfort paymaster (Kora).
 *
 * Builds, signs, and broadcasts with `@solana/kit`, signing the message bytes
 * through the embedded wallet provider (Ed25519). Mirrors the documented
 * `createOpenfortSigner` pattern. `@solana/kit`, `@solana-program/system`,
 * `@solana-program/token`, and `@solana/kora` are loaded lazily so an EVM-only
 * consumer never has to install them — only a Solana send pulls them in at
 * runtime.
 */

import { SDKConfiguration } from '@openfort/openfort-js'
import type { Address, SignatureBytes, SignatureDictionary, TransactionSigner } from '@solana/kit'
import { toError } from '../errors/base.js'
import { ApiRequestError } from '../errors/operation.js'
import { ValidationError } from '../errors/validation.js'
import { WalletError } from '../errors/wallet.js'
import { getDefaultSolanaRpcUrl } from '../utils/rpc.js'
import type { OpenfortEmbeddedSolanaWalletProvider, SolanaCluster, SolanaCommitment } from './types.js'

type Kit = typeof import('@solana/kit')

/** The System program id — the "token" for a native SOL transfer through Kora. */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111'
const SEND_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 1_000

/** Decimal SOL → lamports, without floating-point loss. */
/** @internal Exported for focused validation tests; not part of a package entry point. */
export function solToLamports(amountSol: number): bigint {
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new ValidationError('SOL amount must be a positive finite number.')
  }

  const match = amountSol.toString().match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) throw new ValidationError('SOL amount is invalid.')

  const digits = `${match[1]}${match[2] ?? ''}`.replace(/^0+/, '') || '0'
  const decimalPlaces = (match[2]?.length ?? 0) - Number(match[3] ?? 0)
  const lamportShift = 9 - decimalPlaces
  let lamports: bigint
  if (lamportShift >= 0) {
    lamports = BigInt(digits) * 10n ** BigInt(lamportShift)
  } else {
    const divisor = 10n ** BigInt(-lamportShift)
    const value = BigInt(digits)
    if (value % divisor !== 0n) {
      throw new ValidationError('SOL amount cannot be smaller than one lamport.')
    }
    lamports = value / divisor
  }

  if (lamports > 0xffffffffffffffffn) {
    throw new ValidationError('SOL amount exceeds the maximum Solana token amount.')
  }
  return lamports
}

/** Ed25519 signatures are 64 bytes; trim a trailing recovery byte if one is present. */
function toEd25519Signature(raw: Uint8Array): SignatureBytes {
  const trimmed = raw.length === 65 ? raw.slice(0, 64) : raw
  if (trimmed.length !== 64) {
    throw new WalletError(`Invalid Ed25519 signature: expected 64 bytes, got ${trimmed.length}.`)
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
  commitment?: SolanaCommitment
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

  // SOL sent to a mint or a program-owned account is unrecoverable. A token
  // account can at least be closed by its owner, but it is never the intended
  // destination for a plain transfer either.
  await assertTransferableRecipient(rpc, to, commitment)

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment }).send()

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

  // Derived before the send so a confirmation timeout can still name it. The
  // transaction may land after we stop waiting, and a user who cannot see the
  // signature has no way to check before retrying — which is how one transfer
  // gets sent twice.
  const signature = kit.getSignatureFromTransaction(signedTransaction)

  const sendAndConfirm = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SEND_TIMEOUT_MS)
  try {
    await sendAndConfirm(signedTransaction as Parameters<typeof sendAndConfirm>[0], {
      commitment,
      abortSignal: abortController.signal,
    })
  } catch (cause) {
    // Only the confirmation bound gets relabelled. Everything else — a failed
    // preflight, a rejected transaction, an unreachable node — has its own real
    // reason, and calling those "not confirmed in time" would send the user to
    // an explorer that has nothing to show and imply a retry might double-send.
    if (abortController.signal.aborted) {
      throw new WalletError('The transaction was broadcast but not confirmed in time.', {
        cause: toError(cause),
        details: `Signature ${signature}. Check it on an explorer before sending again.`,
      })
    }
    throw cause
  } finally {
    clearTimeout(timeout)
  }

  return signature
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
  commitment?: SolanaCommitment
}

/** Token program ids whose accounts must never be used as a transfer recipient. */
const TOKEN_PROGRAM_OWNERS = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
])

/**
 * Reads which token program owns a mint.
 *
 * Token-2022 mints live under a different program than legacy SPL ones, and the
 * asset list surfaces both. Deriving the associated token account under the
 * wrong program yields an address that does not exist, so the transfer fails on
 * simulation with an error that says nothing useful.
 */
export async function resolveTokenProgram(
  rpc: { getAccountInfo: (address: never, config?: never) => { send: () => Promise<{ value: unknown }> } },
  mint: string,
  fallback: string,
  commitment?: SolanaCommitment
): Promise<string> {
  try {
    const { value } = await rpc.getAccountInfo(mint as never, { encoding: 'base64', commitment } as never).send()
    const owner = (value as { owner?: string } | null)?.owner
    return owner && TOKEN_PROGRAM_OWNERS.has(owner) ? owner : fallback
  } catch {
    return fallback
  }
}

/**
 * Rejects a recipient that is itself a token account.
 *
 * Deriving an associated token account for one produces an address nobody can
 * sign for, so the transfer would confirm and the tokens would be unspendable
 * forever. Pasting a token account off an explorer is an easy mistake to make,
 * and nothing on-chain reports it as an error.
 */
export async function assertTransferableRecipient(
  rpc: { getAccountInfo: (address: never, config?: never) => { send: () => Promise<{ value: unknown }> } },
  recipient: string,
  commitment?: SolanaCommitment
): Promise<void> {
  let owner: string | undefined
  try {
    const { value } = await rpc.getAccountInfo(recipient as never, { encoding: 'base64', commitment } as never).send()
    owner = (value as { owner?: string } | null)?.owner
  } catch {
    // A read failure is not evidence of a bad recipient; let the send proceed
    // and surface any real problem from the transaction itself.
    return
  }

  if (owner && TOKEN_PROGRAM_OWNERS.has(owner)) {
    throw new ValidationError(
      'This address is a token account, not a wallet. Send to the owner’s wallet address instead.',
      // The owner read off-chain, not the program the caller happened to expect:
      // a Token-2022 account reported as a classic one sends the reader looking
      // in the wrong place.
      { details: `Recipient ${recipient} is owned by the token program ${owner}.` }
    )
  }
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

  await assertTransferableRecipient(rpc, toAddress, commitment)

  const tokenProgram = kit.address(await resolveTokenProgram(rpc, mintAddress, token.TOKEN_PROGRAM_ADDRESS, commitment))

  const [sourceAta] = await token.findAssociatedTokenPda({
    owner: fromAddress,
    tokenProgram,
    mint: mintAddress,
  })
  const [destinationAta] = await token.findAssociatedTokenPda({
    owner: toAddress,
    tokenProgram,
    mint: mintAddress,
  })

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment }).send()

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
            tokenProgram,
          }),
          token.getTransferCheckedInstruction(
            {
              source: sourceAta,
              mint: mintAddress,
              destination: destinationAta,
              authority: signer,
              amount,
              decimals,
            },
            { programAddress: tokenProgram }
          ),
        ],
        tx
      )
  )

  const signedTransaction = await kit.signTransactionMessageWithSigners(message)

  // Derived before the send so a confirmation timeout can still name it. The
  // transaction may land after we stop waiting, and a user who cannot see the
  // signature has no way to check before retrying — which is how one transfer
  // gets sent twice.
  const signature = kit.getSignatureFromTransaction(signedTransaction)

  const sendAndConfirm = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SEND_TIMEOUT_MS)
  try {
    await sendAndConfirm(signedTransaction as Parameters<typeof sendAndConfirm>[0], {
      commitment,
      abortSignal: abortController.signal,
    })
  } catch (cause) {
    // Only the confirmation bound gets relabelled. Everything else — a failed
    // preflight, a rejected transaction, an unreachable node — has its own real
    // reason, and calling those "not confirmed in time" would send the user to
    // an explorer that has nothing to show and imply a retry might double-send.
    if (abortController.signal.aborted) {
      throw new WalletError('The transaction was broadcast but not confirmed in time.', {
        cause: toError(cause),
        details: `Signature ${signature}. Check it on an explorer before sending again.`,
      })
    }
    throw cause
  } finally {
    clearTimeout(timeout)
  }

  return signature
}

/** The Openfort Solana paymaster (Kora) endpoint for a cluster. */
/** @internal Exported for focused configuration tests; not part of a package entry point. */
export function koraRpcUrl(cluster: SolanaCluster, backendUrl?: string): string {
  const segment = cluster === 'mainnet-beta' ? 'mainnet' : cluster
  const baseUrl = backendUrl ?? SDKConfiguration.getInstance()?.backendUrl ?? 'https://api.openfort.io'
  return `${baseUrl.replace(/\/$/, '')}/rpc/solana/${segment}`
}

type KoraTransferParams = {
  from: string
  to: string
  /** Amount in base units — lamports for SOL, token base units for an SPL mint. */
  amountBaseUnits: bigint
  /** System program id for native SOL, or the SPL mint address. */
  tokenMint: string
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  publishableKey: string
  /** Openfort API base URL. Defaults to the SDK configuration. */
  backendUrl?: string
  /** Read endpoint used to confirm the broadcast transaction. */
  rpcUrl?: string
  commitment?: SolanaCommitment
}

/**
 * Sponsor a transfer through the Openfort Solana paymaster (Kora): Kora is the
 * fee payer, the user signs their part with the embedded wallet, and Kora
 * co-signs + broadcasts. Requires a `sponsorSolTransaction` policy on the
 * project. Returns the transaction signature (base58).
 */
/**
 * Refuses a sponsored transaction whose instructions mention an account the
 * caller never asked about.
 *
 * Kora is the fee payer through a noop signer, so the user's signature is the
 * transaction's only authority — whatever comes back is what gets signed. The
 * accounts a legitimate transfer touches are all derivable from the request, so
 * an unexpected one means the response does not describe the transfer that was
 * asked for.
 */
export function assertKoraInstructionsAreExpected(
  instructions: readonly { accounts?: readonly { address?: string }[] }[],
  request: { from: string; acceptableDestinations: readonly string[] }
): void {
  const mentioned = new Set<string>()
  for (const instruction of instructions) {
    for (const account of instruction.accounts ?? []) {
      if (account.address) mentioned.add(account.address)
    }
  }
  if (mentioned.size === 0) return

  // An SPL `transferChecked` names the destination *token account*, not the
  // wallet — the wallet address only appears when Kora also has to create the
  // ATA. Both spellings of the destination are therefore acceptable, and
  // requiring the wallet alone rejects every send to a recipient who already
  // holds the token.
  if (!request.acceptableDestinations.some((destination) => mentioned.has(destination))) {
    throw new WalletError('The paymaster returned a transaction for a different recipient.', {
      details: `Expected one of ${request.acceptableDestinations.join(', ')} among the transaction accounts.`,
    })
  }

  if (!mentioned.has(request.from)) {
    throw new WalletError('The paymaster returned a transaction for a different sender.', {
      details: `Expected ${request.from} among the transaction accounts.`,
    })
  }
}

async function sendViaKora({
  from,
  to,
  amountBaseUnits,
  tokenMint,
  provider,
  cluster,
  publishableKey,
  backendUrl,
  rpcUrl,
  commitment = 'confirmed',
}: KoraTransferParams): Promise<string> {
  // Kora's request takes a JS number; fail loudly rather than silently corrupt
  // an amount that can't be represented exactly.
  if (amountBaseUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new WalletError('Amount is too large to sponsor through the paymaster.')
  }

  const kit = await import('@solana/kit')
  const { KoraClient } = await import('@solana/kora')

  // Kora derives the destination's associated token account server-side, so a
  // token-account recipient is just as unrecoverable here as on the unsponsored
  // path — and sponsored native SOL is no different. Fall back to the cluster's
  // public endpoint rather than skip the check: an app that never configured an
  // RPC still deserves the guard.
  const readUrl = rpcUrl || getDefaultSolanaRpcUrl(cluster)
  await assertTransferableRecipient(kit.createSolanaRpc(readUrl), to, commitment)

  const client = new KoraClient({ rpcUrl: koraRpcUrl(cluster, backendUrl), apiKey: `Bearer ${publishableKey}` })

  // 1. Kora's fee-payer signer.
  const { signer_address } = await client.getPayerSigner()
  const feePayer = kit.createNoopSigner(signer_address as Address)

  // 2. A sponsored transfer (native or SPL), with Kora as the fee payer.
  const { instructions } = await client.transferTransaction({
    amount: Number(amountBaseUnits),
    token: tokenMint,
    source: from,
    destination: to,
    signer_key: signer_address,
  })

  // For SPL the transfer names the destination ATA; the wallet address appears
  // only when Kora also creates it. Accept either.
  const acceptableDestinations = [to]
  if (tokenMint !== SYSTEM_PROGRAM_ID) {
    const token = await import('@solana-program/token')
    const tokenProgram = kit.address(
      await resolveTokenProgram(
        kit.createSolanaRpc(rpcUrl || getDefaultSolanaRpcUrl(cluster)),
        tokenMint,
        token.TOKEN_PROGRAM_ADDRESS,
        commitment
      )
    )
    const [destinationAta] = await token.findAssociatedTokenPda({
      owner: kit.address(to),
      tokenProgram,
      mint: kit.address(tokenMint),
    })
    acceptableDestinations.push(destinationAta)
  }
  assertKoraInstructionsAreExpected(instructions, { from, acceptableDestinations })

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
  const signedTxB64 = response.signed_transaction as string | undefined
  let signatureOut: string
  if (direct) {
    signatureOut = direct
  } else if (signedTxB64) {
    // Wire format: [sigCount(1)][signature(64)]... — the first signature is the tx id.
    const wireBytes = Uint8Array.from(atob(signedTxB64), (c) => c.charCodeAt(0))
    signatureOut = kit.getBase58Decoder().decode(wireBytes.slice(1, 65))
  } else {
    throw new ApiRequestError({ operation: 'Kora transaction signature extraction' })
  }

  // 6. Confirm before reporting success. Kora returning a signature only means
  // the transaction was broadcast; the non-sponsored paths wait for the same
  // commitment, and claiming success on a dropped transaction is worse here
  // because the balance never moves and the explorer link 404s.
  await confirmSignature(kit, signatureOut, rpcUrl, commitment)

  return signatureOut
}

/** Polls until the signature reaches `commitment`, or the send timeout elapses. */
async function confirmSignature(
  kit: Kit,
  signature: string,
  rpcUrl: string | undefined,
  commitment: 'processed' | 'confirmed' | 'finalized'
): Promise<void> {
  if (!rpcUrl) return

  const rpc = kit.createSolanaRpc(rpcUrl)
  const acceptable =
    commitment === 'processed'
      ? ['processed', 'confirmed', 'finalized']
      : commitment === 'confirmed'
        ? ['confirmed', 'finalized']
        : ['finalized']

  const deadline = SEND_TIMEOUT_MS / POLL_INTERVAL_MS
  for (let attempt = 0; attempt < deadline; attempt++) {
    const { value } = await rpc.getSignatureStatuses([signature as never]).send()
    const status = value?.[0]
    if (status?.err) {
      throw new WalletError('The sponsored transaction failed on-chain.')
    }
    if (status?.confirmationStatus && acceptable.includes(status.confirmationStatus)) return
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new WalletError('The sponsored transaction was not confirmed in time.')
}

type SendSolGaslessParams = {
  from: string
  to: string
  amountSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  cluster: SolanaCluster
  /** Project publishable key; sent to the Openfort Solana paymaster (Kora) as a Bearer token. */
  publishableKey: string
  /** Openfort API base URL. Defaults to the SDK configuration. */
  backendUrl?: string
  /** Read endpoint used to confirm the broadcast transaction. */
  rpcUrl?: string
  commitment?: SolanaCommitment
}

/** Send a native SOL transfer with fees sponsored by the Openfort paymaster (Kora). */
export async function sendSolGasless({
  from,
  to,
  amountSol,
  provider,
  cluster,
  publishableKey,
  backendUrl,
  rpcUrl,
  commitment,
}: SendSolGaslessParams): Promise<string> {
  return sendViaKora({
    from,
    to,
    amountBaseUnits: solToLamports(amountSol),
    tokenMint: SYSTEM_PROGRAM_ID,
    provider,
    cluster,
    publishableKey,
    backendUrl,
    rpcUrl,
    commitment,
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
  /** Openfort API base URL. Defaults to the SDK configuration. */
  backendUrl?: string
  /** Read endpoint used to confirm the broadcast transaction. */
  rpcUrl?: string
  commitment?: SolanaCommitment
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
  backendUrl,
  rpcUrl,
  commitment,
}: SendSplTokenGaslessParams): Promise<string> {
  return sendViaKora({
    from,
    to,
    amountBaseUnits: amount,
    tokenMint: mint,
    provider,
    cluster,
    publishableKey,
    backendUrl,
    rpcUrl,
    commitment,
  })
}

/**
 * Read the network fee (in lamports) for a single-signer transfer from the RPC
 * via `getFeeForMessage`. Returns null on any failure so callers can fall back to
 * a neutral "--" rather than a fabricated number. The base fee is per-signature
 * and identical for native and SPL transfers (a single fee-payer signature), so a
 * representative SOL transfer message is enough to price it.
 */
export async function estimateSolanaTransferFeeLamports({
  from,
  to,
  rpcUrl,
}: {
  from: string
  to: string
  rpcUrl: string
}): Promise<bigint | null> {
  try {
    const kit = await import('@solana/kit')
    const { getTransferSolInstruction } = await import('@solana-program/system')

    const fromAddress = kit.address(from)
    const rpc = kit.createSolanaRpc(rpcUrl)
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

    const message = kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      (tx) => kit.setTransactionMessageFeePayer(fromAddress, tx),
      (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) =>
        kit.appendTransactionMessageInstruction(
          getTransferSolInstruction({
            source: kit.createNoopSigner(fromAddress),
            destination: kit.address(to),
            amount: kit.lamports(BigInt(1)),
          }),
          tx
        )
    )

    const compiled = kit.compileTransactionMessage(message)
    const base64Message = kit.getBase64Decoder().decode(kit.getCompiledTransactionMessageEncoder().encode(compiled))

    const { value } = await rpc.getFeeForMessage(base64Message as Parameters<typeof rpc.getFeeForMessage>[0]).send()
    return value == null ? null : BigInt(value)
  } catch {
    return null
  }
}
