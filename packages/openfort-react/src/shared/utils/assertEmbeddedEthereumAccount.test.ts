import { describe, expect, it, vi } from 'vitest'
import { WalletNotConnectedError } from '../../errors/wallet.js'
import { assertEmbeddedEthereumAccount } from './assertEmbeddedEthereumAccount.js'

const ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const

describe('assertEmbeddedEthereumAccount', () => {
  it('matches provider accounts without case sensitivity', async () => {
    const request = vi.fn().mockResolvedValue([`0x${ADDRESS.slice(2).toUpperCase()}`])

    await expect(assertEmbeddedEthereumAccount({ request } as never, ADDRESS)).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledWith({ method: 'eth_accounts' })
  })

  it('rejects an account mismatch with a typed wallet error', async () => {
    const request = vi.fn().mockResolvedValue(['0x2222222222222222222222222222222222222222'])

    await expect(assertEmbeddedEthereumAccount({ request } as never, ADDRESS)).rejects.toBeInstanceOf(
      WalletNotConnectedError
    )
  })

  it('rejects when the intended address is exposed but no longer selected', async () => {
    const request = vi.fn().mockResolvedValue(['0x2222222222222222222222222222222222222222', ADDRESS])

    await expect(assertEmbeddedEthereumAccount({ request } as never, ADDRESS)).rejects.toBeInstanceOf(
      WalletNotConnectedError
    )
  })

  it('accepts the intended provider chain in hexadecimal form', async () => {
    const request = vi.fn().mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x14a34')

    await expect(assertEmbeddedEthereumAccount({ request } as never, ADDRESS, 84532)).resolves.toBeUndefined()
    expect(request).toHaveBeenNthCalledWith(2, { method: 'eth_chainId' })
  })

  it('rejects a chain mismatch with a typed wallet error', async () => {
    const request = vi.fn().mockResolvedValueOnce([ADDRESS]).mockResolvedValueOnce('0x1')

    await expect(assertEmbeddedEthereumAccount({ request } as never, ADDRESS, 84532)).rejects.toMatchObject({
      name: 'WalletNotConnectedError',
      shortMessage: 'The active chain changed before the operation could run.',
    })
  })
})
