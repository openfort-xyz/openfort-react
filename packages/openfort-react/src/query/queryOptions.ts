import { ChainTypeEnum, type EmbeddedAccount, type Openfort, type User } from '@openfort/openfort-js'
import { type DataTag, type DefaultError, queryOptions, type UnusedSkipTokenOptions } from '@tanstack/react-query'
import { openfortKeys, type WalletAssetsKeyParams } from './queryKeys.js'

/** The cache key the user query reads and writes. */
export type UserQueryKey = ReturnType<typeof openfortKeys.user>

/** The cache key the embedded-accounts query reads and writes. */
export type EmbeddedAccountsQueryKey = ReturnType<typeof openfortKeys.embeddedAccounts>

/**
 * What {@link getUserQueryOptions} returns.
 *
 * The key is tagged with its payload, so `queryClient.getQueryData(key)` and
 * `setQueryData` are typed as `User` without a manual type argument.
 */
export type UserQueryOptions = UnusedSkipTokenOptions<User, DefaultError, User, UserQueryKey> & {
  queryKey: DataTag<UserQueryKey, User, DefaultError>
}

/**
 * What {@link getEmbeddedAccountsQueryOptions} returns.
 *
 * The key is tagged with its payload, so `queryClient.getQueryData(key)` and
 * `setQueryData` are typed as `EmbeddedAccount[]` without a manual type argument.
 */
export type EmbeddedAccountsQueryOptions = UnusedSkipTokenOptions<
  EmbeddedAccount[],
  DefaultError,
  EmbeddedAccount[],
  EmbeddedAccountsQueryKey
> & {
  queryKey: DataTag<EmbeddedAccountsQueryKey, EmbeddedAccount[], DefaultError>
}

/** Reads the authenticated user. The provider fetches through this too. */
export function fetchUser(client: Openfort): Promise<User> {
  return client.user.get()
}

/** Reads the user's embedded wallet accounts. The provider fetches through this too. */
export function fetchEmbeddedAccounts(client: Openfort): Promise<EmbeddedAccount[]> {
  return client.embeddedWallet.list({ limit: 100 })
}

/**
 * Query options for the current user.
 *
 * Shares its key and fetcher with the provider, which publishes every user it
 * loads to this cache entry — so `useQuery(getUserQueryOptions(client))` reads
 * the same user the SDK is working with rather than a second copy.
 */
export function getUserQueryOptions(client: Openfort): UserQueryOptions {
  return queryOptions({
    queryKey: openfortKeys.user(),
    queryFn: () => fetchUser(client),
    retry: false,
  })
}

/**
 * Query options for the user's embedded wallet accounts.
 *
 * Shares its key and fetcher with the provider, which publishes every account
 * list it loads to this cache entry.
 */
export function getEmbeddedAccountsQueryOptions(client: Openfort): EmbeddedAccountsQueryOptions {
  return queryOptions({
    queryKey: openfortKeys.embeddedAccounts(),
    queryFn: () => fetchEmbeddedAccounts(client),
    retry: false,
  })
}

/**
 * Key and enablement for an Ethereum wallet-assets query.
 *
 * Assets can only be read once an address is known, and — outside multi-chain
 * mode — once the chain is known too, so both are required rather than asserted.
 */
export function getWalletAssetsQueryScope(params: {
  address: string | undefined
  chainId: number | undefined
  multiChain: boolean
  assets: readonly string[]
  hasChain: boolean
}) {
  const { address, chainId, multiChain, assets, hasChain } = params
  const enabled = multiChain ? !!address : !!address && !!chainId && hasChain
  const keyParams: WalletAssetsKeyParams = {
    address: address ?? '',
    chainType: ChainTypeEnum.EVM,
    multiChain,
    chainId: multiChain ? undefined : chainId,
    assets,
  }
  return { queryKey: openfortKeys.walletAssets(keyParams), enabled }
}
