import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SolanaContextProvider, useSolanaContext } from '../../solana/SolanaContext'
import type { SolanaConfig } from '../../solana/types'

function makeWrapper(config: SolanaConfig) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SolanaContextProvider config={config}>{children}</SolanaContextProvider>
  }
}

describe('SolanaContext — resolveRpcUrl', () => {
  it('resolves the default devnet URL for "devnet"', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({ cluster: 'devnet' }),
    })
    expect(result.current.rpcUrl).toBe('https://api.devnet.solana.com')
  })

  it('resolves the default testnet URL for "testnet"', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({ cluster: 'testnet' }),
    })
    expect(result.current.rpcUrl).toBe('https://api.testnet.solana.com')
  })

  it('resolves the default mainnet-beta URL for "mainnet-beta"', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({ cluster: 'mainnet-beta' }),
    })
    expect(result.current.rpcUrl).toBe('https://api.mainnet-beta.solana.com')
  })

  it('uses custom rpcUrl when provided for the cluster', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({
        cluster: 'devnet',
        rpcUrls: { devnet: 'https://my-custom-rpc.example.com' },
      }),
    })
    expect(result.current.rpcUrl).toBe('https://my-custom-rpc.example.com')
  })

  it('falls back to default when custom rpcUrl not set for active cluster', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({
        cluster: 'devnet',
        rpcUrls: { 'mainnet-beta': 'https://my-mainnet-rpc.example.com' },
      }),
    })
    expect(result.current.rpcUrl).toBe('https://api.devnet.solana.com')
  })

  it('throws CONFIGURATION_ERROR for an unknown cluster with no custom RPC', () => {
    // Suppress React's console.error — the throw is expected and React logs it as noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        renderHook(() => useSolanaContext(), {
          wrapper: makeWrapper({ cluster: 'unknown-cluster' as never }),
        })
      ).toThrow()
    } finally {
      spy.mockRestore()
    }
  })

  it('uses custom rpcUrl for an unknown cluster when provided', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({
        cluster: 'unknown-cluster' as never,
        rpcUrls: { 'unknown-cluster': 'https://custom-rpc.example.com' } as never,
      }),
    })
    expect(result.current.rpcUrl).toBe('https://custom-rpc.example.com')
  })
})

describe('SolanaContext — defaults', () => {
  it('defaults to devnet when cluster is not configured', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({}),
    })
    expect(result.current.cluster).toBe('devnet')
  })

  it('defaults to "confirmed" commitment', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({ cluster: 'devnet' }),
    })
    expect(result.current.commitment).toBe('confirmed')
  })

  it('uses provided commitment', () => {
    const { result } = renderHook(() => useSolanaContext(), {
      wrapper: makeWrapper({ cluster: 'devnet', commitment: 'finalized' }),
    })
    expect(result.current.commitment).toBe('finalized')
  })
})
