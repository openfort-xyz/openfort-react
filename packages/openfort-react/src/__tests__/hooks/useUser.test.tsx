import { EmbeddedState } from '@openfort/openfort-js'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMockOpenfortClient } from '../mocks/openfortClient'
import { createTestWrapper } from '../mocks/TestWrapper'

// Mock the wallet hooks that useUser depends on
vi.mock('../../ethereum/hooks/useEthereumEmbeddedWallet', () => ({
  useEthereumEmbeddedWallet: () => ({ isConnected: false, status: 'disconnected' }),
}))
vi.mock('../../solana/hooks/useSolanaEmbeddedWallet', () => ({
  useSolanaEmbeddedWallet: () => ({ isConnected: false, status: 'disconnected' }),
}))

// Must import after mocks are set up
const { useUser } = await import('../../hooks/openfort/useUser')

describe('useUser', () => {
  it('returns isAuthenticated=false when state is NONE', () => {
    const wrapper = createTestWrapper({ embeddedState: EmbeddedState.NONE })
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('returns isAuthenticated=false when state is UNAUTHENTICATED', () => {
    const wrapper = createTestWrapper({ embeddedState: EmbeddedState.UNAUTHENTICATED })
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns isAuthenticated=true when state is EMBEDDED_SIGNER_NOT_CONFIGURED', () => {
    const wrapper = createTestWrapper({
      embeddedState: EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED,
    })
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns isAuthenticated=true when state is READY', () => {
    const wrapper = createTestWrapper({ embeddedState: EmbeddedState.READY })
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns user and linkedAccounts from context', () => {
    const mockUser = { id: 'usr_123', linkedAccounts: [] } as any
    const mockAccounts = [{ provider: 'email', email: 'test@test.com' }] as any
    const wrapper = createTestWrapper({
      embeddedState: EmbeddedState.READY,
      user: mockUser,
      linkedAccounts: mockAccounts,
    })
    const { result } = renderHook(() => useUser(), { wrapper })

    expect(result.current.user).toBe(mockUser)
    expect(result.current.linkedAccounts).toBe(mockAccounts)
  })

  it('isConnected is false when wallet is not connected even if authenticated', () => {
    const wrapper = createTestWrapper({
      embeddedState: EmbeddedState.READY,
      user: { id: 'usr_123', linkedAccounts: [] } as any,
    })
    const { result } = renderHook(() => useUser(), { wrapper })

    // isAuthenticated is true but isConnected requires wallet
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isConnected).toBe(false)
  })

  it('getAccessToken calls validateAndRefreshToken then getAccessToken', async () => {
    const mockClient = createMockOpenfortClient()
    mockClient.getAccessToken.mockResolvedValue('test-token-123')

    const wrapper = createTestWrapper({
      embeddedState: EmbeddedState.READY,
      client: mockClient as any,
    })
    const { result } = renderHook(() => useUser(), { wrapper })

    const token = await result.current.getAccessToken()

    expect(mockClient.validateAndRefreshToken).toHaveBeenCalledOnce()
    expect(mockClient.getAccessToken).toHaveBeenCalledOnce()
    expect(token).toBe('test-token-123')
  })
})
