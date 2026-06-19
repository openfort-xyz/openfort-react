import { ChainTypeEnum } from '@openfort/openfort-js'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEST_CHAIN, DEST_CHAIN_SOL, DEST_USDC, DEST_USDC_SOL } from '../components/Pages/Deposit/sources'

// useFundingTarget reads uiConfig.funding from useOpenfort and chainType from
// useOpenfortCore. Stub both so we can drive the chain-aware default selection.
const mockUiConfig: { funding?: { targetChain?: string; targetCurrency?: string; targetAddress?: string } } = {}
let mockChainType: ChainTypeEnum = ChainTypeEnum.EVM

vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({ uiConfig: mockUiConfig }),
}))
vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({ chainType: mockChainType }),
}))

const { useFundingTarget } = await import('../components/Pages/Deposit/useFundingTarget')

describe('useFundingTarget', () => {
  beforeEach(() => {
    mockUiConfig.funding = undefined
    mockChainType = ChainTypeEnum.EVM
  })

  it('defaults to USDC on Base for EVM wallets', () => {
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: DEST_CHAIN, currency: DEST_USDC, address: undefined })
  })

  it('defaults to USDC on Solana mainnet for SVM wallets', () => {
    mockChainType = ChainTypeEnum.SVM
    const { result } = renderHook(() => useFundingTarget())
    expect(result.current).toEqual({ chain: DEST_CHAIN_SOL, currency: DEST_USDC_SOL, address: undefined })
  })

  it('honors integrator overrides regardless of chain type', () => {
    mockUiConfig.funding = { targetChain: 'eip155:1', targetCurrency: '0xabc', targetAddress: '0xdest' }

    const evm = renderHook(() => useFundingTarget())
    expect(evm.result.current).toEqual({ chain: 'eip155:1', currency: '0xabc', address: '0xdest' })

    mockChainType = ChainTypeEnum.SVM
    const svm = renderHook(() => useFundingTarget())
    expect(svm.result.current).toEqual({ chain: 'eip155:1', currency: '0xabc', address: '0xdest' })
  })
})
