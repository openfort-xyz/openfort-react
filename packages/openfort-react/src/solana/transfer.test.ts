import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../errors/validation.js'
import { WalletError } from '../errors/wallet.js'
import { getOpenfortBackendUrl } from '../openfort/core/client.js'
import {
  assertKoraPaymentIsExpected,
  assertTransferableRecipient,
  koraRpcUrl,
  resolveTokenProgram,
  sendSplTokenGasless,
  solToLamports,
} from './transfer.js'

vi.mock('../openfort/core/client.js', () => ({
  getOpenfortBackendUrl: vi.fn(() => 'https://api.openfort.io'),
}))

describe('solToLamports', () => {
  it.each([
    [1, 1_000_000_000n],
    [0.000_001, 1_000n],
    [1e-7, 100n],
    [1e3, 1_000_000_000_000n],
  ])('converts %s SOL without depending on decimal notation', (amount, expected) => {
    expect(solToLamports(amount)).toBe(expected)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e-10])('rejects invalid amount %s', (amount) => {
    expect(() => solToLamports(amount)).toThrow(ValidationError)
  })

  it('rejects values outside Solana u64 token bounds', () => {
    expect(() => solToLamports(20_000_000_000)).toThrow('maximum Solana token amount')
  })
})

describe('koraRpcUrl', () => {
  it('defaults to the production Openfort API', () => {
    expect(koraRpcUrl('testnet')).toBe('https://api.openfort.io/rpc/solana/testnet')
  })

  it('uses the explicit backend URL and removes a trailing slash', () => {
    expect(koraRpcUrl('devnet', 'https://staging.example/')).toBe('https://staging.example/rpc/solana/devnet')
  })

  it('uses the configured SDK backend URL', () => {
    vi.mocked(getOpenfortBackendUrl).mockReturnValueOnce('https://configured.example')
    expect(koraRpcUrl('mainnet-beta')).toBe('https://configured.example/rpc/solana/mainnet')
  })
})

describe('assertTransferableRecipient', () => {
  const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  const rpcReturning = (owner: string | null) => ({
    getAccountInfo: () => ({ send: async () => ({ value: owner === null ? null : { owner } }) }),
  })

  it('rejects a recipient owned by a token program', async () => {
    await expect(
      assertTransferableRecipient(rpcReturning(SPL_TOKEN_PROGRAM) as never, 'token-account')
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a recipient owned by the Token-2022 program', async () => {
    await expect(
      assertTransferableRecipient(
        rpcReturning('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') as never,
        'token-2022-account'
      )
    ).rejects.toThrow(ValidationError)
  })

  it('accepts a system-owned wallet and an account that does not exist yet', async () => {
    await expect(
      assertTransferableRecipient(rpcReturning('11111111111111111111111111111111') as never, 'wallet')
    ).resolves.toBeUndefined()
    await expect(assertTransferableRecipient(rpcReturning(null) as never, 'fresh-wallet')).resolves.toBeUndefined()
  })

  it('does not block the send when the lookup itself fails', async () => {
    const failing = {
      getAccountInfo: () => ({
        send: async () => {
          throw new Error('rpc unreachable')
        },
      }),
    }
    await expect(assertTransferableRecipient(failing as never, 'wallet')).resolves.toBeUndefined()
  })
})

describe('resolveTokenProgram', () => {
  const LEGACY = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
  const rpcReturning = (owner: string | null) => ({
    getAccountInfo: () => ({ send: async () => ({ value: owner === null ? null : { owner } }) }),
  })

  it('reads the owning program off the mint', async () => {
    await expect(resolveTokenProgram(rpcReturning(TOKEN_2022) as never, 'mint', LEGACY)).resolves.toBe(TOKEN_2022)
    await expect(resolveTokenProgram(rpcReturning(LEGACY) as never, 'mint', LEGACY)).resolves.toBe(LEGACY)
  })

  it('falls back when the owner is unknown or unreadable', async () => {
    await expect(resolveTokenProgram(rpcReturning('SomeOtherProgram') as never, 'mint', LEGACY)).resolves.toBe(LEGACY)
    await expect(resolveTokenProgram(rpcReturning(null) as never, 'mint', LEGACY)).resolves.toBe(LEGACY)
  })
})

describe('sendSplTokenGasless', () => {
  const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

  /**
   * The sponsored path hands the recipient straight to Kora, which derives the
   * associated token account server-side. Without this guard a token-account
   * recipient produces an ATA nobody can sign for, so the tokens are gone.
   */
  it('refuses a token-account recipient before reaching the paymaster', async () => {
    const koraClient = vi.fn()
    vi.doMock('@solana/kit', () => ({
      createSolanaRpc: () => ({
        getAccountInfo: () => ({ send: async () => ({ value: { owner: SPL_TOKEN_PROGRAM } }) }),
      }),
    }))
    vi.doMock('@solana/kora', () => ({ KoraClient: koraClient }))
    vi.doMock('@solana-program/token', () => ({ TOKEN_PROGRAM_ADDRESS: SPL_TOKEN_PROGRAM }))

    await expect(
      sendSplTokenGasless({
        from: 'sender-wallet',
        to: 'token-account',
        mint: 'mint-address',
        amount: 1_000n,
        decimals: 6,
        provider: {} as never,
        cluster: 'devnet',
        publishableKey: 'pk_test',
      })
    ).rejects.toThrow(ValidationError)

    expect(koraClient).not.toHaveBeenCalled()
    vi.doUnmock('@solana/kit')
    vi.doUnmock('@solana/kora')
    vi.doUnmock('@solana-program/token')
  })
})

describe('assertKoraPaymentIsExpected', () => {
  const FEE_TOKEN = 'fee-token-mint'
  const SOURCE_ATA = 'user-fee-token-account'
  const DESTINATION_ATA = 'kora-fee-token-account'
  const FROM = 'sender-wallet'
  const EXPECTED = [FROM, SOURCE_ATA, DESTINATION_ATA, FEE_TOKEN, 'token-program']
  const ix = (...addresses: string[]) => ({ accounts: addresses.map((address) => ({ address })) })
  const payment = (overrides: Record<string, unknown> = {}) => ({
    payment_token: FEE_TOKEN,
    payment_amount: 1_500,
    payment_instruction: ix(SOURCE_ATA, DESTINATION_ATA, FROM),
    ...overrides,
  })

  it('accepts a payment that only touches the fee transfer', () => {
    expect(() =>
      assertKoraPaymentIsExpected(payment(), { feeToken: FEE_TOKEN, expectedAccounts: EXPECTED })
    ).not.toThrow()
  })

  it('accepts a zero fee, which is what free paymaster pricing quotes', () => {
    expect(() =>
      assertKoraPaymentIsExpected(payment({ payment_amount: 0 }), { feeToken: FEE_TOKEN, expectedAccounts: EXPECTED })
    ).not.toThrow()
  })

  it('rejects a payment quoted in a different token', () => {
    expect(() =>
      assertKoraPaymentIsExpected(payment({ payment_token: 'other-mint' }), {
        feeToken: FEE_TOKEN,
        expectedAccounts: EXPECTED,
      })
    ).toThrow(WalletError)
  })

  it.each([
    undefined,
    -1,
    1.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 2,
  ])('rejects the unusable fee amount %s', (amount) => {
    expect(() =>
      assertKoraPaymentIsExpected(payment({ payment_amount: amount }), {
        feeToken: FEE_TOKEN,
        expectedAccounts: EXPECTED,
      })
    ).toThrow(WalletError)
  })

  it('rejects a payment that debits an account outside the fee transfer', () => {
    expect(() =>
      assertKoraPaymentIsExpected(payment({ payment_instruction: ix(SOURCE_ATA, 'attacker-ata', FROM) }), {
        feeToken: FEE_TOKEN,
        expectedAccounts: EXPECTED,
      })
    ).toThrow(WalletError)
  })
})

describe('sendSolGasless', () => {
  const FROM = 'sender-wallet'
  const RECIPIENT = 'recipient-wallet'
  const KORA_SIGNER = 'kora-fee-payer'
  const FEE_TOKEN = 'fee-token-mint'
  const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

  /**
   * Enough of `@solana/kit` to build and encode a message. The fakes carry the
   * instruction list through unchanged so a test can assert on what was built.
   */
  const mockKit = () => ({
    createSolanaRpc: () => ({
      getAccountInfo: () => ({ send: async () => ({ value: { owner: '11111111111111111111111111111111' } }) }),
    }),
    address: (value: string) => value,
    lamports: (value: bigint) => value,
    createNoopSigner: (address: string) => ({ address }),
    pipe: (value: unknown, ...fns: ((input: unknown) => unknown)[]) => fns.reduce((acc, fn) => fn(acc), value),
    createTransactionMessage: () => ({ instructions: [] as unknown[] }),
    setTransactionMessageFeePayerSigner: (feePayer: unknown, tx: object) => ({ ...tx, feePayer }),
    setTransactionMessageLifetimeUsingBlockhash: (lifetime: unknown, tx: object) => ({ ...tx, lifetime }),
    appendTransactionMessageInstructions: (instructions: unknown[], tx: { instructions: unknown[] }) => ({
      ...tx,
      instructions: [...tx.instructions, ...instructions],
    }),
    appendTransactionMessageInstruction: (instruction: unknown, tx: { instructions: unknown[] }) => ({
      ...tx,
      instructions: [...tx.instructions, instruction],
    }),
    partiallySignTransactionMessageWithSigners: async (tx: object) => ({
      ...tx,
      messageBytes: new Uint8Array([1]),
      signatures: {},
    }),
    getBase64EncodedWireTransaction: () => 'base64-wire',
    getBase58Encoder: () => ({ encode: () => new Uint8Array(64) }),
    getBase58Decoder: () => ({ decode: () => 'decoded-signature' }),
  })

  const setup = (koraOverrides: Record<string, unknown> = {}) => {
    const kora = {
      getPayerSigner: vi.fn(async () => ({ signer_address: KORA_SIGNER })),
      getBlockhash: vi.fn(async () => ({ blockhash: 'blockhash' })),
      signAndSendTransaction: vi.fn(async () => ({ signature: 'tx-signature' })),
      transferTransaction: vi.fn(),
      ...koraOverrides,
    }
    vi.doMock('@solana/kit', () => mockKit())
    vi.doMock('@solana/kora', () => ({
      KoraClient: function KoraClient() {
        return kora
      },
    }))
    vi.doMock('@solana-program/system', () => ({
      getTransferSolInstruction: vi.fn((input: unknown) => ({ kind: 'transferSol', input })),
    }))
    vi.doMock('@solana-program/token', () => ({
      TOKEN_PROGRAM_ADDRESS: SPL_TOKEN_PROGRAM,
      findAssociatedTokenPda: async ({ owner }: { owner: string }) => [`${owner}-ata`],
    }))
    return kora
  }

  const unmock = () => {
    for (const id of ['@solana/kit', '@solana/kora', '@solana-program/system', '@solana-program/token']) {
      vi.doUnmock(id)
    }
    vi.resetModules()
  }

  const send = async (overrides: Record<string, unknown> = {}) => {
    const { sendSolGasless: send } = await import('./transfer.js')
    return send({
      from: FROM,
      to: RECIPIENT,
      amountSol: 1,
      provider: { signTransaction: async () => ({ signature: 'user-signature' }) } as never,
      cluster: 'devnet',
      publishableKey: 'pk_test',
      ...overrides,
    } as never)
  }

  /**
   * The hosted Openfort endpoint does not route `transferTransaction`, so a
   * sponsored send that reaches for it fails before broadcast.
   */
  it('builds the transfer locally instead of asking the paymaster for one', async () => {
    const kora = setup()
    await expect(send()).resolves.toBe('tx-signature')

    expect(kora.transferTransaction).not.toHaveBeenCalled()
    expect(kora.getPayerSigner).toHaveBeenCalledTimes(1)
    expect(kora.signAndSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: 'base64-wire', signer_key: KORA_SIGNER })
    )
    unmock()
  })

  it('appends the paymaster fee payment when the user pays in a token', async () => {
    const getPaymentInstruction = vi.fn(async () => ({
      payment_token: FEE_TOKEN,
      payment_amount: 2_500,
      payment_address: KORA_SIGNER,
      payment_instruction: { accounts: [{ address: `${FROM}-ata` }, { address: `${KORA_SIGNER}-ata` }] },
    }))
    const kora = setup({ getPaymentInstruction })

    await expect(send({ feeToken: FEE_TOKEN })).resolves.toBe('tx-signature')

    expect(getPaymentInstruction).toHaveBeenCalledWith(
      expect.objectContaining({ fee_token: FEE_TOKEN, source_wallet: FROM, signer_key: KORA_SIGNER })
    )
    expect(kora.signAndSendTransaction).toHaveBeenCalledTimes(1)
    unmock()
  })

  it('does not pay a fee the paymaster routed to somebody else', async () => {
    setup({
      getPaymentInstruction: async () => ({
        payment_token: FEE_TOKEN,
        payment_amount: 2_500,
        payment_address: KORA_SIGNER,
        payment_instruction: { accounts: [{ address: 'attacker-ata' }] },
      }),
    })

    await expect(send({ feeToken: FEE_TOKEN })).rejects.toThrow('fee payment for a different account')
    unmock()
  })

  it('reports an @solana/kora too old to build a fee payment', async () => {
    setup({ getPaymentInstruction: undefined })

    await expect(send({ feeToken: FEE_TOKEN })).rejects.toThrow('getPaymentInstruction')
    unmock()
  })
})
