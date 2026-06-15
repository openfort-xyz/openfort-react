import type { EmbeddedAccount } from '@openfort/openfort-js'
import { getBase58Decoder, getBase64Encoder } from '@solana/kit'
import { describe, expect, it, vi } from 'vitest'
import { createSolanaProvider } from '../../solana/provider'
import { createSolanaSigner } from '../../solana/signer'

const ADDRESS = '11111111111111111111111111111111'
const SIG_64 = new Uint8Array(64).map((_, i) => i)
const SIG_64_BASE58 = getBase58Decoder().decode(SIG_64)

function makeProvider(signature: string) {
  return createSolanaProvider({
    account: { address: ADDRESS } as EmbeddedAccount,
    signTransaction: vi.fn(async () => ({ signature, publicKey: ADDRESS })),
    signAllTransactions: vi.fn(async () => []),
    signMessage: vi.fn(async () => ''),
  })
}

describe('createSolanaSigner', () => {
  it('produces a kit TransactionSigner that decodes the provider signature', async () => {
    const provider = makeProvider(SIG_64_BASE58)
    const signer = createSolanaSigner(provider)

    expect(signer.address).toBe(ADDRESS)

    const dicts = await signer.signTransactions([{ messageBytes: new Uint8Array([1, 2, 3]) }] as never)
    expect(Array.from(dicts[0][ADDRESS] as Uint8Array)).toEqual(Array.from(SIG_64))
  })

  it('rejects a signature that is not 64 bytes', async () => {
    const provider = makeProvider(getBase58Decoder().decode(new Uint8Array(32)))
    const signer = createSolanaSigner(provider)
    await expect(signer.signTransactions([{ messageBytes: new Uint8Array([1]) }] as never)).rejects.toThrow(/64 bytes/)
  })
})

describe('OpenfortSolanaProvider.signTransactionWire', () => {
  it('assembles a broadcast-ready wire transaction (count + signature + message)', async () => {
    const provider = makeProvider(SIG_64_BASE58)
    const message = new Uint8Array([9, 8, 7, 6, 5])

    const { wireTransaction, signature } = await provider.signTransactionWire(message)
    expect(signature).toBe(SIG_64_BASE58)

    const bytes = new Uint8Array(getBase64Encoder().encode(wireTransaction))
    expect(bytes[0]).toBe(1) // single signature
    expect(Array.from(bytes.slice(1, 65))).toEqual(Array.from(SIG_64))
    expect(Array.from(bytes.slice(65))).toEqual(Array.from(message))
  })

  it('rejects a signature that is not 64 bytes', async () => {
    const provider = makeProvider(getBase58Decoder().decode(new Uint8Array(10)))
    await expect(provider.signTransactionWire(new Uint8Array([1]))).rejects.toThrow(/64 bytes/)
  })
})
