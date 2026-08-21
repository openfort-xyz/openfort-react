import type { QueryFunction } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { base } from 'viem/chains'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TOKEN = '0x0000000000000000000000000000000000000002' as const

const h = vi.hoisted(() => ({
  queryOptions: undefined as
    | {
        queryFn: QueryFunction<unknown>
        queryKey: readonly unknown[]
      }
    | undefined,
  getAssets: vi.fn(),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createWalletClient: () => ({
      extend: () => ({ getAssets: h.getAssets }),
    }),
  }
})

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfortUIContext: () => ({
    walletConfig: {
      ethereum: {
        assets: {
          [base.id]: [undefined, TOKEN],
        },
      },
    },
    publishableKey: 'pk_test_assets',
    overrides: undefined,
    thirdPartyAuth: undefined,
    chains: [base],
  }),
}))

vi.mock('../../hooks/openfort/useUser.js', () => ({
  useUser: () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: { client: object }) => unknown) => selector({ client: {} }),
}))

vi.mock('../../query/useQuery.js', () => ({
  useQuery: (options: typeof h.queryOptions) => {
    h.queryOptions = options
    return {
      data: undefined,
      error: null,
      isLoading: false,
      isPending: false,
      isFetching: false,
      status: 'pending',
      fetchStatus: 'idle',
      queryKey: options?.queryKey,
    }
  },
}))

vi.mock('./useEthereumEmbeddedWallet.js', () => ({
  useEthereumEmbeddedWallet: () => ({
    status: 'connected',
    address: '0x0000000000000000000000000000000000000001',
    chainId: base.id,
  }),
}))

const { useEthereumWalletAssets } = await import('./useEthereumWalletAssets.js')

describe('useEthereumWalletAssets runtime asset sanitization', () => {
  beforeEach(() => {
    h.queryOptions = undefined
    h.getAssets.mockReset()
  })

  it('filters missing configured assets from the single-chain key, request, and response merge', async () => {
    h.getAssets.mockResolvedValueOnce({ [base.id]: [] }).mockResolvedValueOnce({
      [base.id]: [
        {
          type: 'erc20',
          address: TOKEN,
          balance: 1n,
          metadata: { symbol: 'TEST', decimals: 18 },
        },
      ],
    })

    renderHook(() => useEthereumWalletAssets())

    expect(h.queryOptions?.queryKey[2]).toMatchObject({ assets: [TOKEN] })
    const assets = await h.queryOptions?.queryFn({ queryKey: h.queryOptions.queryKey } as never)

    expect(h.getAssets).toHaveBeenNthCalledWith(2, {
      chainIds: [base.id],
      assets: {
        '0x2105': [{ address: TOKEN, type: 'erc20' }],
      },
    })
    expect(assets).toEqual([
      expect.objectContaining({
        type: 'erc20',
        address: TOKEN,
        balance: 1n,
      }),
    ])
  })
})
