import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { QueryClientBoundary } from '../../query/QueryClientBoundary.js'

describe('QueryClientBoundary', () => {
  it('provides a client when the app has none', () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientBoundary>{children}</QueryClientBoundary>,
    })

    expect(result.current).toBeInstanceOf(QueryClient)
  })

  it("reuses the app's client instead of nesting a second provider", () => {
    const appQueryClient = new QueryClient()
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={appQueryClient}>
          <QueryClientBoundary>{children}</QueryClientBoundary>
        </QueryClientProvider>
      ),
    })

    expect(result.current).toBe(appQueryClient)
  })
})
