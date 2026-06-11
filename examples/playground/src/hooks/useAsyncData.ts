import { useCallback, useEffect, useRef, useState } from 'react'
import { toError } from '@/lib/errors'

type UseAsyncDataOptions<T> = {
  queryFn: () => Promise<T>
  queryKey: unknown[]
  enabled?: boolean
}

/**
 * Simple fetch hook. No TanStack Query dependency.
 */
export function useAsyncData<T>({ queryFn, queryKey, enabled = true }: UseAsyncDataOptions<T>): {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<T | undefined>
} {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const fetchData = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined
    setIsLoading(true)
    setError(null)
    try {
      const result = await queryFnRef.current()
      setData(result)
      return result
    } catch (err) {
      setError(toError(err))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  const queryKeyString = JSON.stringify(queryKey)
  useEffect(() => {
    if (!enabled) return
    fetchData().catch(() => {})
  }, [enabled, queryKeyString, fetchData])

  return { data, error, isLoading, refetch: fetchData }
}
