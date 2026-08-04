import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletError } from '../../errors/wallet.js'

const h = vi.hoisted(() => ({
  query: {
    data: undefined as undefined | [],
    error: undefined as unknown,
    isPending: false,
    queryKey: [] as unknown[],
  },
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { client: object }) => unknown) => selector({ client: {} }),
}))

vi.mock('../../query/useQuery.js', () => ({
  useQuery: () => h.query,
}))

vi.mock('../SolanaContext.js', async () => {
  const { createContext } = await import('react')
  // A real context with a default value, so the hook reads the RPC URL the same
  // way it does under a provider.
  return {
    SolanaContext: createContext<{ rpcUrl: string } | null>({ rpcUrl: 'https://rpc.example' }),
    useSolanaContext: () => ({ rpcUrl: 'https://rpc.example' }),
  }
})

vi.mock('./useSolanaEmbeddedWallet.js', () => ({
  useSolanaEmbeddedWallet: () => ({ status: 'connected', address: 'solana-address' }),
}))

const { useSolanaWalletAssets } = await import('./useSolanaWalletAssets.js')

describe('useSolanaWalletAssets error contract', () => {
  beforeEach(() => {
    h.query.data = undefined
    h.query.error = undefined
  })

  it('normalizes an RPC failure to a typed wallet error without exposing the raw error', () => {
    const cause = new Error('rpc authorization token rejected')
    h.query.error = cause

    const { result } = renderHook(() => useSolanaWalletAssets())

    expect(result.current.error).toBeInstanceOf(WalletError)
    expect(result.current.error).toMatchObject({
      name: 'WalletError',
      shortMessage: 'Failed to fetch Solana wallet assets.',
      details: 'rpc authorization token rejected',
      cause,
    })
    expect(result.current.error).not.toBe(cause)
    expect(result.current.data).toBeNull()
  })

  it('preserves the empty error state before a query fails', () => {
    const { result } = renderHook(() => useSolanaWalletAssets())

    expect(result.current.error).toBeUndefined()
    expect(result.current.data).toBeNull()
  })
})
