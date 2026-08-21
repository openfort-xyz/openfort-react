import { AccountTypeEnum, ChainTypeEnum } from '@openfort/openfort-js'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Drive the chain-aware receiver resolution by stubbing the boundary hooks.
// The funding chains list is empty so the fund() effect short-circuits — we only
// assert which embedded wallet supplies the destination address. The recipient is
// resolved by the funding target's chain family (which tracks the active chain
// type), so the target mock below mirrors useFundingTarget's chain-aware default.
type MockActiveWallet = { accountType?: AccountTypeEnum; accounts: { id: string; chainId?: number }[] }
let mockChainType: ChainTypeEnum = ChainTypeEnum.EVM
const mockEthWallet: { status: string; address?: string; activeWallet?: MockActiveWallet | null } = {
  status: 'disconnected',
}
const mockSolWallet: { status: string; address?: string } = { status: 'disconnected' }

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: () => ({ chainType: mockChainType }),
}))
vi.mock('../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => mockEthWallet,
}))
vi.mock('../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => mockSolWallet,
}))
vi.mock('../hooks/openfort/useFunding', async (importOriginal) => ({
  // Keep the real pure helpers (cryptoPaymentMethod); stub only the hook.
  ...(await importOriginal<typeof import('../hooks/openfort/useFunding')>()),
  useFunding: () => ({
    session: null,
    error: null,
    loading: false,
    isAvailable: false,
    fund: vi.fn(),
    payLink: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('../hooks/openfort/useFundingChains', () => ({
  useFundingChains: () => ({ chains: [], railChains: [], loading: false, error: null }),
  nominalUnits: (decimals: number) => `1${'0'.repeat(decimals + 1)}`,
}))
vi.mock('../hooks/openfort/useFundingTarget', () => ({
  useFundingTarget: () => ({
    chain: mockChainType === ChainTypeEnum.SVM ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' : 'eip155:8453',
    currency: '0xUSDC',
  }),
}))

const { useDepositRoute } = await import('../components/Pages/Deposit/useDepositRoute')

describe('useDepositRoute', () => {
  beforeEach(() => {
    mockChainType = ChainTypeEnum.EVM
    mockEthWallet.status = 'disconnected'
    mockEthWallet.address = undefined
    mockEthWallet.activeWallet = undefined
    mockSolWallet.status = 'disconnected'
    mockSolWallet.address = undefined
  })

  it('resolves the destination from the Ethereum wallet on EVM', () => {
    mockEthWallet.status = 'connected'
    mockEthWallet.address = '0xEthAddr'
    mockSolWallet.status = 'connected'
    mockSolWallet.address = 'SoLAddr'

    const { result } = renderHook(() => useDepositRoute('crypto'))
    expect(result.current.address).toBe('0xEthAddr')
  })

  it('resolves the destination from the Solana wallet on SVM', () => {
    mockChainType = ChainTypeEnum.SVM
    mockEthWallet.status = 'connected'
    mockEthWallet.address = '0xEthAddr'
    mockSolWallet.status = 'connected'
    mockSolWallet.address = 'SoLAddr'

    const { result } = renderHook(() => useDepositRoute('crypto'))
    expect(result.current.address).toBe('SoLAddr')
  })

  it('leaves the destination undefined when the active wallet is disconnected', () => {
    mockChainType = ChainTypeEnum.SVM
    mockSolWallet.status = 'disconnected'

    const { result } = renderHook(() => useDepositRoute('crypto'))
    expect(result.current.address).toBeUndefined()
  })

  it('blocks funding when a chain-scoped account is not deployed on the EVM target chain', () => {
    mockEthWallet.status = 'connected'
    mockEthWallet.address = '0xEthAddr'
    // Smart account deployed only on Polygon Amoy; the EVM funding target is Base (8453).
    mockEthWallet.activeWallet = { accountType: AccountTypeEnum.SMART_ACCOUNT, accounts: [{ id: 'a', chainId: 80002 }] }
    expect(renderHook(() => useDepositRoute('crypto')).result.current.accountUnusableOnTarget).toBe(true)

    // Deployed on the target chain → usable.
    mockEthWallet.activeWallet = { accountType: AccountTypeEnum.SMART_ACCOUNT, accounts: [{ id: 'a', chainId: 8453 }] }
    expect(renderHook(() => useDepositRoute('crypto')).result.current.accountUnusableOnTarget).toBe(false)
  })

  it('never blocks an EOA — it shares one address across EVM chains', () => {
    mockEthWallet.status = 'connected'
    mockEthWallet.address = '0xEthAddr'
    mockEthWallet.activeWallet = { accountType: AccountTypeEnum.EOA, accounts: [] }
    expect(renderHook(() => useDepositRoute('crypto')).result.current.accountUnusableOnTarget).toBe(false)
  })
})
