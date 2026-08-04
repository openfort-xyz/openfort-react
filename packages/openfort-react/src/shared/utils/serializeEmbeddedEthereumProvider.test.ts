import type { Openfort } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { WalletNotConnectedError } from '../../errors/wallet.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { invalidateEmbeddedSignerOperations, runEmbeddedSignerOperation } from './embeddedSignerOperationQueue.js'
import { serializeEmbeddedEthereumProvider } from './serializeEmbeddedEthereumProvider.js'

const ACCOUNT_A = '0x1111111111111111111111111111111111111111' as const
const ACCOUNT_B = '0x2222222222222222222222222222222222222222' as const

describe('serializeEmbeddedEthereumProvider', () => {
  it('preserves an existing account binding when a downstream connector only requests serialization', () => {
    const client = {} as Openfort
    const provider = serializeEmbeddedEthereumProvider(
      { request: vi.fn() } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      client,
      ACCOUNT_A
    )

    expect(serializeEmbeddedEthereumProvider(provider, client)).toBe(provider)
  })

  it('rejects signing from a retained provider after its account stops being active', async () => {
    let activeAddress: `0x${string}` = ACCOUNT_A
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [activeAddress]
      return 'signed'
    })
    const provider = serializeEmbeddedEthereumProvider(
      { request } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      {} as Openfort,
      ACCOUNT_A
    )

    await expect(provider.request({ method: 'eth_accounts' })).resolves.toEqual([ACCOUNT_A])
    activeAddress = ACCOUNT_B

    for (const args of [
      { method: 'personal_sign', params: ['message', ACCOUNT_A] },
      { method: 'eth_sendTransaction', params: [{ from: ACCOUNT_A }] },
    ]) {
      await expect(provider.request(args)).rejects.toBeInstanceOf(WalletNotConnectedError)
    }

    expect(request.mock.calls.filter(([args]) => args.method !== 'eth_accounts')).toEqual([])
  })

  it('reports the current accounts rather than throwing once the pinned account is stale', async () => {
    let activeAddress: `0x${string}` = ACCOUNT_A
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [activeAddress]
      return 'signed'
    })
    const provider = serializeEmbeddedEthereumProvider(
      { request } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      {} as Openfort,
      ACCOUNT_A
    )

    activeAddress = ACCOUNT_B

    // EIP-1193 requires eth_accounts to report current state, and wagmi's
    // isAuthorized() reads a rejection as a failed reconnect.
    await expect(provider.request({ method: 'eth_accounts' })).resolves.toEqual([ACCOUNT_B])
    await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe('signed')
  })

  it('performs the account assertion and request atomically in the client queue', async () => {
    let releaseFirstRequest!: () => void
    const firstRequestGate = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    const request = vi.fn(async ({ method, params }: { method: string; params?: readonly unknown[] | object }) => {
      if (method === 'eth_accounts') return [ACCOUNT_A]
      if (params && Array.isArray(params) && params[0] === 'first') await firstRequestGate
      return params
    })
    const provider = serializeEmbeddedEthereumProvider(
      { request } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      {} as Openfort,
      ACCOUNT_A
    )

    const first = provider.request({ method: 'personal_sign', params: ['first', ACCOUNT_A] })
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    const second = provider.request({ method: 'personal_sign', params: ['second', ACCOUNT_A] })

    expect(request).toHaveBeenCalledTimes(2)
    releaseFirstRequest()
    await expect(first).resolves.toEqual(['first', ACCOUNT_A])
    await expect(second).resolves.toEqual(['second', ACCOUNT_A])
    expect(request.mock.calls.map(([args]) => args.method)).toEqual([
      'eth_accounts',
      'personal_sign',
      'eth_accounts',
      'personal_sign',
    ])
  })

  it('does not forward a request when its account assertion crosses an auth boundary', async () => {
    const client = {} as Openfort
    let resolveAccounts!: (accounts: `0x${string}`[]) => void
    const accounts = new Promise<`0x${string}`[]>((resolve) => {
      resolveAccounts = resolve
    })
    const request = vi.fn(({ method }: { method: string }) => {
      if (method === 'eth_accounts') return accounts
      return Promise.resolve('signed')
    })
    const provider = serializeEmbeddedEthereumProvider(
      { request } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      client,
      ACCOUNT_A
    )

    const signing = provider.request({ method: 'personal_sign', params: ['message', ACCOUNT_A] })
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    invalidateEmbeddedSignerOperations(client)
    resolveAccounts([ACCOUNT_A])

    await expect(signing).rejects.toBeInstanceOf(WalletNotConnectedError)
    expect(request).toHaveBeenCalledOnce()
  })

  it('does not forward an address-less provider request reserved before an auth boundary', async () => {
    const client = {} as Openfort
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocker = runEmbeddedSignerOperation(client, () => gate)
    const request = vi.fn().mockResolvedValue('signed')
    const provider = serializeEmbeddedEthereumProvider(
      { request } as unknown as OpenfortEmbeddedEthereumWalletProvider,
      client
    )
    const signing = provider.request({ method: 'personal_sign', params: ['message', ACCOUNT_A] })

    invalidateEmbeddedSignerOperations(client)
    release()

    await expect(blocker).rejects.toBeInstanceOf(WalletNotConnectedError)
    await expect(signing).rejects.toBeInstanceOf(WalletNotConnectedError)
    expect(request).not.toHaveBeenCalled()
  })
})
