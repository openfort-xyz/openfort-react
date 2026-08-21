import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashQueryKey } from '../query/hashQueryKey.js'

const mocks = vi.hoisted(() => ({
  fundingBaseUrl: 'https://funding.example',
  queryOptions: [] as Array<{ queryKey: readonly unknown[] }>,
}))

vi.mock('../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    uiConfig: { fundingBaseUrl: mocks.fundingBaseUrl },
    publishableKey: 'pk_test_fake',
  }),
}))

vi.mock('../query/useQuery', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    mocks.queryOptions.push(options)
    return {
      data: undefined,
      error: null,
      isLoading: true,
      isFetching: false,
      refetch: vi.fn(),
      queryKey: options.queryKey,
    }
  },
}))

const { useFundingChains } = await import('../hooks/openfort/useFundingChains.js')

describe('useFundingChains query identity', () => {
  beforeEach(() => {
    mocks.fundingBaseUrl = 'https://funding.example'
    mocks.queryOptions = []
  })

  it('keys the request by an opaque scope for the effective funding endpoint', () => {
    mocks.fundingBaseUrl = 'https://funding-user:funding-password@funding-a.example?apiKey=funding-secret'
    const { rerender } = renderHook(() => useFundingChains())
    const firstKey = mocks.queryOptions.at(-1)?.queryKey
    const serializedFirstKey = JSON.stringify(firstKey)

    mocks.fundingBaseUrl = 'https://funding-b.example'
    rerender()
    const secondKey = mocks.queryOptions.at(-1)?.queryKey

    expect(hashQueryKey(firstKey ?? [])).not.toBe(hashQueryKey(secondKey ?? []))
    expect(serializedFirstKey).not.toContain('funding-password')
    expect(serializedFirstKey).not.toContain('funding-secret')
    expect(serializedFirstKey).not.toContain('funding-a.example')
  })
})
