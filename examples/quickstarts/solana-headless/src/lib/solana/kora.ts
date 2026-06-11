import type { OpenfortEmbeddedSolanaWalletProvider } from '@openfort/react/solana'
import {
  type Address,
  appendTransactionMessageInstructions,
  type Blockhash,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  type Instruction,
  type MicroLamports,
  partiallySignTransactionMessageWithSigners,
  type SignatureBytes,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit'
import { KoraClient } from '@solana/kora'
import {
  updateOrAppendSetComputeUnitLimitInstruction,
  updateOrAppendSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget'
import { Base58 } from 'ox'

const COMPUTE_UNIT_LIMIT = 200_000
const COMPUTE_UNIT_PRICE = 50_000n as MicroLamports

interface KoraConfig {
  rpcUrl: string
  apiKey: string
}

interface SendGaslessTransactionParams {
  from: Address
  to: Address
  amountInSol: number
  provider: OpenfortEmbeddedSolanaWalletProvider
  koraConfig: KoraConfig
}

interface GaslessTransactionResult {
  signature: string
}

/** Validate that the signature is a 64-byte Ed25519 signature */
function validateEd25519Signature(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) {
    throw new Error(`Invalid Ed25519 signature: expected 64 bytes, got ${raw.length}`)
  }
  return raw
}

function buildTransactionMessage(
  feePayer: ReturnType<typeof createNoopSigner>,
  blockhash: string,
  instructions: Instruction[]
) {
  const msg = createTransactionMessage({ version: 0 })
  const withPayer = setTransactionMessageFeePayerSigner(feePayer, msg)
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash: blockhash as Blockhash, lastValidBlockHeight: 0n },
    withPayer
  )
  const withPrice = updateOrAppendSetComputeUnitPriceInstruction(COMPUTE_UNIT_PRICE, withLifetime)
  const withLimit = updateOrAppendSetComputeUnitLimitInstruction(COMPUTE_UNIT_LIMIT, withPrice)
  return appendTransactionMessageInstructions(instructions, withLimit)
}

export async function sendGaslessSolTransaction({
  from,
  to,
  amountInSol,
  provider,
  koraConfig,
}: SendGaslessTransactionParams): Promise<GaslessTransactionResult> {
  const client = new KoraClient({
    rpcUrl: koraConfig.rpcUrl,
    apiKey: koraConfig.apiKey,
  })

  // Step 1: Get Kora's signer address
  const { signer_address } = await client.getPayerSigner()
  const koraNoopSigner = createNoopSigner(signer_address as Address)

  // Step 2: Create transfer instruction via Kora
  const transferLamports = Math.floor(amountInSol * 1_000_000_000)
  const transferSol = await client.transferTransaction({
    amount: transferLamports,
    token: '11111111111111111111111111111111',
    source: from,
    destination: to,
    signer_key: signer_address,
  })

  // Step 3: Build transaction with Kora as fee payer
  const { blockhash } = await client.getBlockhash()
  const transaction = buildTransactionMessage(koraNoopSigner, blockhash, transferSol.instructions)

  // Step 4: Partially sign (noop for Kora placeholder), then sign with Openfort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partiallySignedTx = await partiallySignTransactionMessageWithSigners(transaction as any)

  const result = await provider.signTransaction(new Uint8Array(partiallySignedTx.messageBytes))
  const signatureBytes = validateEd25519Signature(Base58.toBytes(result.signature))

  const userSignedTx = {
    ...partiallySignedTx,
    signatures: {
      ...partiallySignedTx.signatures,
      [from]: signatureBytes as SignatureBytes,
    },
  }
  const userSignedWire = getBase64EncodedWireTransaction(userSignedTx)

  // Step 5: Send to Kora for co-signing and submission to Solana
  const response = await client.signAndSendTransaction({
    transaction: userSignedWire,
    signer_key: signer_address,
  })

  // Extract signature: Kora may return it directly or in signed_transaction wire format
  let txSignature = (response as unknown as Record<string, unknown>).signature as string | undefined
  if (!txSignature) {
    const signedTxB64 = (response as unknown as Record<string, unknown>).signed_transaction as string | undefined
    if (signedTxB64) {
      const wireBytes = Uint8Array.from(atob(signedTxB64), (c) => c.charCodeAt(0))
      // Wire format: [num_signatures (1 byte), ...signatures (64 bytes each), ...]
      // First signature (bytes 1..65) is the tx signature
      const firstSig = wireBytes.slice(1, 65)
      txSignature = Base58.fromBytes(firstSig)
    }
  }

  if (!txSignature) {
    throw new Error('Failed to extract transaction signature from Kora response')
  }

  return { signature: txSignature }
}
