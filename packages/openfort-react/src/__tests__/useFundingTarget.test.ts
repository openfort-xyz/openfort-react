import { ChainTypeEnum } from '@openfort/openfort-js'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEST_CHAIN,
  DEST_CHAIN_SOL,
  DEST_USDC,
  DEST_USDC_SOL,
  NATIVE_TOKEN_ADDRESS,
} from '../hooks/openfort/fundingSources.js'

// useFundingTarget reads uiConfig.funding from useOpenfort, chainType from
// useOpenfortCore, and the active EVM chain from useEthereumEmbeddedWallet. Stub
// all three so we can drive the chain-aware default selection.
const mockUiConfig: { funding?: { targetChain?: string; targetCurrency?: string } } = {}
let mockChainType: ChainTypeEnum = ChainTypeEnum.EVM
let mockEthWallet: { status: string; chainId?: number } = { status: 'connected', chainId: 8453 }

vi.mock('../components/Openfort/useOpenfort', () => {
  const hook = () => ({ uiConfig: mockUiConfig })
  return { useOpenfort: hook, useOpenfortConfig: hook }
})
vi.mock('../openfort/useOpenfort', () => {
  const getState = () => ({ chainType: mockChainType })
  return { useOpenfortCore: (selector: (s: ReturnType<typeof getState>) => unknown) => selector(getState()) }
})
vi.mock('../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => mockEthWallet,
}))

const { useFundingTarget } = await import('../hooks/openfort/useFundingTarget.js')

describe('useFundingTarget', () => {
  beforeEach(() => {
    mockUiConfig.funding = undefined
    mockChainType = ChainTypeEnum.EVM
    mockEthWallet = { status: 'connected', chainId: 8453 }
  })

  it('defaults to USDC on the active EVM chain when it is Base', () => {
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: DEST_CHAIN, currency: DEST_USDC })
  })

  it('defaults to native on the active EVM chain when it is not Base', () => {
    mockEthWallet = { status: 'connected', chainId: 11155111 } // Sepolia
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: 'eip155:11155111', currency: NATIVE_TOKEN_ADDRESS })
  })

  it('falls back to USDC on Base when the EVM wallet is not connected', () => {
    mockEthWallet = { status: 'disconnected' }
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: DEST_CHAIN, currency: DEST_USDC })
  })

  it('defaults to USDC on Solana mainnet for SVM wallets', () => {
    mockChainType = ChainTypeEnum.SVM
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: DEST_CHAIN_SOL, currency: DEST_USDC_SOL })
  })

  it('honors integrator chain/currency overrides regardless of chain type', () => {
    mockUiConfig.funding = { targetChain: 'eip155:1', targetCurrency: '0xabc' }

    const evm = renderHook(() => useFundingTarget())
    expect(evm.result.current).toEqual({ chain: 'eip155:1', currency: '0xabc' })

    mockChainType = ChainTypeEnum.SVM
    const svm = renderHook(() => useFundingTarget())
    expect(svm.result.current).toEqual({ chain: 'eip155:1', currency: '0xabc' })
  })
})
