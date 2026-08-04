import { SDKConfiguration } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../errors/validation.js'
import { assertTransferableRecipient, koraRpcUrl, resolveTokenProgram, solToLamports } from './transfer.js'

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
      assertTransferableRecipient(rpcReturning(SPL_TOKEN_PROGRAM) as never, 'token-account', SPL_TOKEN_PROGRAM)
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a recipient owned by the Token-2022 program', async () => {
    await expect(
      assertTransferableRecipient(
        rpcReturning('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') as never,
        'token-2022-account',
        SPL_TOKEN_PROGRAM
      )
    ).rejects.toThrow(ValidationError)
  })

  it('accepts a system-owned wallet and an account that does not exist yet', async () => {
    await expect(
      assertTransferableRecipient(
        rpcReturning('11111111111111111111111111111111') as never,
        'wallet',
        SPL_TOKEN_PROGRAM
      )
    ).resolves.toBeUndefined()
    await expect(
      assertTransferableRecipient(rpcReturning(null) as never, 'fresh-wallet', SPL_TOKEN_PROGRAM)
    ).resolves.toBeUndefined()
  })

  it('does not block the send when the lookup itself fails', async () => {
    const failing = {
      getAccountInfo: () => ({
        send: async () => {
          throw new Error('rpc unreachable')
        },
      }),
    }
    await expect(assertTransferableRecipient(failing as never, 'wallet', SPL_TOKEN_PROGRAM)).resolves.toBeUndefined()
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
