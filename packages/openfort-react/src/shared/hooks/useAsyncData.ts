'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type UseAsyncDataOptions<T> = {
  queryFn: () => Promise<T>
  queryKey: readonly unknown[]
  enabled?: boolean
  refetchInterval?: number
  staleTime?: number
}

/**
 * Simple fetch-with-cache hook. Replaces useQuery for internal SDK use.
 * No external dependency on TanStack Query.
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
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastFetchRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  // Serialize queryKey to a stable string so the effect only re-runs when values change,
  // not when array/object references change.
  const queryKeyStr = JSON.stringify(queryKey)

  const fetchData = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined
    setIsLoading(true)
    setError(null)
    try {
      const result = await queryFnRef.current()
      setData(result)
      lastFetchRef.current = Date.now()
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    fetchData().catch(() => {})
  }, [enabled, queryKeyStr])

  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastFetchRef.current
      if (staleTime > 0 && elapsed < staleTime) return
      fetchData().catch(() => {})
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
    refetch: fetchData,
  }
}
