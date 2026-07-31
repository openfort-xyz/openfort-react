import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError } from '../errors/auth.js'

const h = vi.hoisted(() => ({
  initSiwe: vi.fn(),
  updateUser: vi.fn(),
  signMessage: vi.fn(),
}))

vi.mock('../openfort/useOpenfort', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      client: { auth: { initSiwe: h.initSiwe } },
      user: null,
      updateUser: h.updateUser,
    }),
}))

vi.mock('../ethereum/OpenfortEthereumBridgeContext', () => ({
  useEthereumBridge: () => ({
    account: {
      address: '0x1234567890123456789012345678901234567890',
      connector: { type: 'injected', id: 'mock' },
      chain: { id: 1, name: 'Ethereum' },
    },
    chainId: 1,
    signMessage: h.signMessage,
  }),
}))

const { useConnectWithSiwe } = await import('./useConnectWithSiwe.js')

describe('useConnectWithSiwe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes local typed errors to onError', async () => {
    const error = new AuthenticationError('nonce failed')
    h.initSiwe.mockRejectedValueOnce(error)
    const onError = vi.fn()
    const { result } = renderHook(() => useConnectWithSiwe())

    await act(() => result.current.connectWithSiwe({ onError }))

    expect(onError).toHaveBeenCalledWith('Failed to connect with SIWE.', error)
  })
})
