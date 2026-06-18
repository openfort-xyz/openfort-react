'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseAsyncDataOptions<T> = {
  queryFn: () => Promise<T>
  queryKey: readonly unknown[]
  enabled?: boolean
  refetchInterval?: number
  staleTime?: number
}

type CacheEntry = { data: unknown; timestamp: number }

/** Module-level cache shared across hook instances, so revisiting a view paints instantly. */
const dataCache = new Map<string, CacheEntry>()

/**
 * Empty/absent results are NOT cached — only meaningful data is. This prevents a
 * transient empty response (e.g. a cold/erroring asset call) from being pinned
 * and shown as "no balance" on later mounts.
 */
function isEmptyResult(result: unknown): boolean {
  if (result == null) return true
  if (Array.isArray(result)) return result.length === 0
  return false
}

/**
 * Simple fetch-with-cache hook. Replaces useQuery for internal SDK use.
 * No external dependency on TanStack Query.
 *
 * Stale-while-revalidate: a cached (non-empty) result for the same `queryKey` is
 * painted synchronously on (re)mount — so navigating away and back is instant —
 * then refreshed in the background (skipped while younger than `staleTime`).
 */
export function useAsyncData<T>({
  queryFn,
  queryKey,
  enabled = true,
  refetchInterval,
  staleTime = 0,
}: UseAsyncDataOptions<T>): {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  isPending: boolean
  refetch: () => Promise<T | undefined>
} {
  // Serialize queryKey to a stable string so the effect only re-runs when values change,
  // not when array/object references change.
  const queryKeyStr = JSON.stringify(queryKey)

  const [data, setData] = useState<T | undefined>(() => dataCache.get(queryKeyStr)?.data as T | undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastFetchRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const fetchData = useCallback(
    async (showLoading = true): Promise<T | undefined> => {
      if (!enabled) return undefined
      if (showLoading) setIsLoading(true)
      setError(null)
      try {
        const result = await queryFnRef.current()
        if (!isEmptyResult(result)) dataCache.set(queryKeyStr, { data: result, timestamp: Date.now() })
        lastFetchRef.current = Date.now()
        setData(result)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    },
    [enabled, queryKeyStr]
  )

  useEffect(() => {
    if (!enabled) return
    const cached = dataCache.get(queryKeyStr)
    if (cached) {
      // Paint cached data immediately; revalidate in the background unless still fresh.
      setData(cached.data as T)
      const fresh = staleTime > 0 && Date.now() - cached.timestamp < staleTime
      if (!fresh) fetchData(false).catch(() => {})
    } else {
      fetchData(true).catch(() => {})
    }
  }, [enabled, queryKeyStr, staleTime, fetchData])

  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastFetchRef.current
      if (staleTime > 0 && elapsed < staleTime) return
      fetchData(false).catch(() => {})
    }, refetchInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, refetchInterval, staleTime, fetchData])

  return {
    data,
    error,
    isLoading,
    isPending: isLoading,
    refetch: useCallback(() => fetchData(true), [fetchData]),
  }
}
