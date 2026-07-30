'use client'

import {
  type DefaultError,
  type QueryKey,
  useQuery as tanstackUseQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import { hashQueryKey } from './hashQueryKey.js'

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

/**
 * `useQuery` with Openfort defaults: a bigint-tolerant key hash and the
 * `queryKey` re-attached to the result so callers can invalidate or prefetch
 * the exact query they are reading without rebuilding the key.
 */
export function useQuery<
  queryFnData = unknown,
  error = DefaultError,
  data = queryFnData,
  queryKey extends QueryKey = QueryKey,
>(parameters: UseQueryParameters<queryFnData, error, data, queryKey>): UseQueryReturnType<data, error> {
  const result = tanstackUseQuery({
    ...parameters,
    queryKeyHashFn: hashQueryKey,
  }) as UseQueryReturnType<data, error>
  result.queryKey = parameters.queryKey
  return result
}
