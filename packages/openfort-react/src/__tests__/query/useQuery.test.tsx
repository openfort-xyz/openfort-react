import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuery } from '../../query/useQuery.js'
import { createTestWrapper } from '../mocks/wrapper.js'

describe('useQuery', () => {
  it('caches on a bigint key without throwing, and keeps distinct bigints apart', async () => {
    const wrapper = createTestWrapper()
    const queryFn = vi.fn(async (amount: bigint) => `result-${amount}`)

    const first = renderHook(() => useQuery({ queryKey: ['amount', 1n], queryFn: () => queryFn(1n) }), { wrapper })
    await waitFor(() => expect(first.result.current.data).toBe('result-1'))

    const second = renderHook(() => useQuery({ queryKey: ['amount', 2n], queryFn: () => queryFn(2n) }), { wrapper })
    await waitFor(() => expect(second.result.current.data).toBe('result-2'))

    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('returns the query key alongside the result', () => {
    const { result } = renderHook(
      () => useQuery({ queryKey: ['openfort', 'thing'], queryFn: async () => 1, enabled: false }),
      { wrapper: createTestWrapper() }
    )

    expect(result.current.queryKey).toEqual(['openfort', 'thing'])
  })

  it('does not run the query function while disabled', () => {
    const queryFn = vi.fn(async () => 1)
    renderHook(() => useQuery({ queryKey: ['openfort', 'gated'], queryFn, enabled: false }), {
      wrapper: createTestWrapper(),
    })

    expect(queryFn).not.toHaveBeenCalled()
  })
})
