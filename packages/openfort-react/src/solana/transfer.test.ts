import { SDKConfiguration } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../errors/validation.js'
import { WalletError } from '../errors/wallet.js'
import {
  assertKoraInstructionsAreExpected,
  assertTransferableRecipient,
  koraRpcUrl,
  resolveTokenProgram,
  sendSplTokenGasless,
  solToLamports,
} from './transfer.js'

vi.mock('@openfort/openfort-js', () => ({
  SDKConfiguration: { getInstance: vi.fn(() => undefined) },
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
    vi.mocked(SDKConfiguration.getInstance).mockReturnValueOnce({
      backendUrl: 'https://configured.example',
    } as ReturnType<typeof SDKConfiguration.getInstance>)
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

describe('assertKoraInstructionsAreExpected', () => {
  const FROM = 'sender-wallet'
  const RECIPIENT = 'recipient-wallet'
  const RECIPIENT_ATA = 'recipient-associated-token-account'
  const ix = (...addresses: string[]) => ({ accounts: addresses.map((address) => ({ address })) })

  /**
   * The common sponsored SPL send: the recipient already holds the token, so
   * Kora returns a lone `transferChecked` naming the destination *token
   * account* and never the wallet.
   */
  it('accepts a transfer that names the destination token account', () => {
    expect(() =>
      assertKoraInstructionsAreExpected([ix('source-ata', 'mint', RECIPIENT_ATA, FROM)], {
        from: FROM,
        acceptableDestinations: [RECIPIENT, RECIPIENT_ATA],
      })
    ).not.toThrow()
  })

  it('accepts a transfer that names the recipient wallet, as a first send does', () => {
    expect(() =>
      assertKoraInstructionsAreExpected([ix(FROM, RECIPIENT)], {
        from: FROM,
        acceptableDestinations: [RECIPIENT],
      })
    ).not.toThrow()
  })

  it('rejects a transaction that redirects to somewhere never requested', () => {
    expect(() =>
      assertKoraInstructionsAreExpected([ix('source-ata', 'mint', 'attacker-ata', FROM)], {
        from: FROM,
        acceptableDestinations: [RECIPIENT, RECIPIENT_ATA],
      })
    ).toThrow(WalletError)
  })

  it('rejects a transaction that debits a different sender', () => {
    expect(() =>
      assertKoraInstructionsAreExpected([ix('other-wallet', RECIPIENT_ATA)], {
        from: FROM,
        acceptableDestinations: [RECIPIENT, RECIPIENT_ATA],
      })
    ).toThrow(WalletError)
  })
})
