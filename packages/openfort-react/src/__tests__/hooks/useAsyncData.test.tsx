import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A native ETH send keys its gas estimate on the bigint amount
 * (`['gas-estimate', account, to, value, ...]`). `JSON.stringify` throws on a
 * BigInt, which used to crash the whole confirm modal to a white screen. The
 * hook must serialize bigint keys instead of throwing.
 */
import { invalidateAsyncData, useAsyncData } from '../../shared/hooks/useAsyncData'

describe('useAsyncData bigint queryKey', () => {
  beforeEach(() => {
    invalidateAsyncData()
  })

  it('does not throw when the queryKey contains a bigint', async () => {
    const queryFn = vi.fn().mockResolvedValue('ok')

    const { result } = renderHook(() => useAsyncData({ queryKey: ['gas-estimate', 100000000000000000n], queryFn }))

    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('treats distinct bigint keys as distinct cache entries', async () => {
    const queryFn = vi.fn().mockImplementation((amount: bigint) => Promise.resolve(amount.toString()))

    const first = renderHook(() => useAsyncData({ queryKey: ['amount', 1n], queryFn: () => queryFn(1n) }))
    await waitFor(() => expect(first.result.current.data).toBe('1'))

    const second = renderHook(() => useAsyncData({ queryKey: ['amount', 2n], queryFn: () => queryFn(2n) }))
    await waitFor(() => expect(second.result.current.data).toBe('2'))

    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})
