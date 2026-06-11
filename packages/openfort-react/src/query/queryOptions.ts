import type { Openfort } from '@openfort/openfort-js'
import type { queryOptions } from '@tanstack/react-query'
import { openfortKeys } from './queryKeys'

/**
 * Query options factory for fetching the current user.
 *
 * Returns vanilla query options (framework-agnostic) that can be used with
 * `useQuery`, `queryClient.ensureQueryData`, or `queryClient.fetchQuery`.
 */
export function getUserQueryOptions(client: Openfort) {
  return {
    queryKey: openfortKeys.user(),
    queryFn: () => client.user.get(),
    staleTime: 30_000,
    retry: false,
  } satisfies Parameters<typeof queryOptions>[0]
}

/**
 * Query options factory for fetching embedded wallet accounts.
 */
export function getEmbeddedAccountsQueryOptions(client: Openfort) {
  return {
    queryKey: openfortKeys.embeddedAccounts(),
    queryFn: () => client.embeddedWallet.list({ limit: 100 }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  } satisfies Parameters<typeof queryOptions>[0]
}
