import { ChainTypeEnum } from '@openfort/openfort-js'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashQueryKey } from '../query/hashQueryKey.js'

const mocks = vi.hoisted(() => ({
  client: {},
  walletConfig: undefined as
    | {
        ethereum?: { rpcUrls?: Record<number, string> }
        solana?: { rpcUrls?: Record<string, string> }
      }
    | undefined,
  queryOptions: [] as Array<{ queryKey: readonly unknown[] }>,
}))

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (state: { client: object }) => unknown) => selector({ client: mocks.client }),
}))

vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({ walletConfig: mocks.walletConfig }),
}))

vi.mock('../query/useQuery', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    mocks.queryOptions.push(options)
    return { data: undefined, error: null, isLoading: true, refetch: vi.fn() }
  },
}))

const { useBalance } = await import('./useBalance.js')

describe('useBalance query identity', () => {
  beforeEach(() => {
    mocks.walletConfig = undefined
    mocks.queryOptions = []
  })

  it('keys EVM balances by the effective RPC URL', () => {
    mocks.walletConfig = { ethereum: { rpcUrls: { 8453: 'https://user:rpc-secret@rpc-a.example?key=api-secret' } } }
    const { rerender } = renderHook(() => useBalance({ address: '0xabc', chainType: ChainTypeEnum.EVM, chainId: 8453 }))
    const firstKey = mocks.queryOptions.at(-1)?.queryKey
    const serializedFirstKey = JSON.stringify(firstKey)

    mocks.walletConfig = { ethereum: { rpcUrls: { 8453: 'https://rpc-b.example' } } }
    rerender()
    const secondKey = mocks.queryOptions.at(-1)?.queryKey

    expect(hashQueryKey(firstKey ?? [])).not.toBe(hashQueryKey(secondKey ?? []))
    expect(serializedFirstKey).not.toContain('rpc-secret')
    expect(serializedFirstKey).not.toContain('api-secret')
  })

  it('keys Solana balances by the effective RPC URL and commitment', () => {
    mocks.walletConfig = { solana: { rpcUrls: { devnet: 'https://solana-a.example' } } }
    const { rerender } = renderHook(
      ({ commitment }: { commitment: 'confirmed' | 'finalized' }) =>
        useBalance({ address: 'solana-address', chainType: ChainTypeEnum.SVM, cluster: 'devnet', commitment }),
      { initialProps: { commitment: 'confirmed' as const } }
    )
    const confirmedKey = mocks.queryOptions.at(-1)?.queryKey

    rerender({ commitment: 'finalized' })
    const finalizedKey = mocks.queryOptions.at(-1)?.queryKey
    mocks.walletConfig = { solana: { rpcUrls: { devnet: 'https://solana-b.example' } } }
    rerender({ commitment: 'finalized' })
    const secondRpcKey = mocks.queryOptions.at(-1)?.queryKey

    expect(hashQueryKey(confirmedKey ?? [])).not.toBe(hashQueryKey(finalizedKey ?? []))
    expect(hashQueryKey(finalizedKey ?? [])).not.toBe(hashQueryKey(secondRpcKey ?? []))
  })
})
