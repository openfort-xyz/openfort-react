'use client'

import {
  type DefaultError,
  type QueryKey,
  useQuery as tanstackUseQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import { hashQueryKey } from './hashQueryKey.js'
import { withQueryResultOverrides } from './withQueryResultOverrides.js'

/** Options accepted by {@link useQuery}. The hash function is supplied by the wrapper. */
type UseQueryParameters<
  queryFnData = unknown,
  error = DefaultError,
  data = queryFnData,
  queryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<queryFnData, error, data, queryKey>, 'queryKeyHashFn'>

/** A TanStack query result carrying the key it was built from. */
export type UseQueryReturnType<data = unknown, error = DefaultError> = UseQueryResult<data, error> & {
  queryKey: QueryKey
}

/** Reads an HTTP status off an error or the first cause that carries one. */
function responseStatus(error: unknown): number | undefined {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 10; depth++) {
    const candidate = current as { status?: unknown; response?: { status?: unknown } }
    const status = typeof candidate.status === 'number' ? candidate.status : candidate.response?.status
    if (typeof status === 'number') return status
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

/**
 * Retries transient failures only.
 *
 * A 4xx is the server stating the request is wrong — a mis-scoped publishable
 * key answers 401 just as fast the fourth time, and retrying only delays the
 * error the user needs to see.
 */
function retryTransientFailures(failureCount: number, error: unknown): boolean {
  const status = responseStatus(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 2
}

/**
 * `useQuery` with Openfort defaults: a bigint-tolerant key hash and the
 * `queryKey` re-attached to the result so callers can invalidate or prefetch
 * the exact query they are reading without rebuilding the key.
 *
 * The retry and `throwOnError` defaults are set here rather than left to the
 * host's `QueryClient`. `QueryClientBoundary` deliberately reuses the app's
 * client, and an app-level `throwOnError: true` would otherwise throw SDK query
 * failures during render — unmounting the modal mid-flow and breaking the
 * guarantee that a consumer cannot crash the render tree.
 */
export function useQuery<
  queryFnData = unknown,
  error = DefaultError,
  data = queryFnData,
  queryKey extends QueryKey = QueryKey,
>(parameters: UseQueryParameters<queryFnData, error, data, queryKey>): UseQueryReturnType<data, error> {
  const result = tanstackUseQuery({
    retry: retryTransientFailures,
    ...parameters,
    throwOnError: false,
    queryKeyHashFn: hashQueryKey,
  })
  return withQueryResultOverrides(result, { queryKey: parameters.queryKey })
}
