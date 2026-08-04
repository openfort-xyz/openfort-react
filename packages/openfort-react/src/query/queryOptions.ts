import { ChainTypeEnum, type EmbeddedAccount, type Openfort, type User } from '@openfort/openfort-js'
import { type DataTag, type DefaultError, queryOptions, type UnusedSkipTokenOptions } from '@tanstack/react-query'
import {
  getOpenfortQueryInputScope,
  getOpenfortQueryScope,
  openfortKeys,
  type WalletAssetsChainKeyConfig,
  type WalletAssetsKeyParams,
} from './queryKeys.js'

/**
 * The cache key the user query reads and writes.
 *
 * @example
 * ```ts
 * import { openfortKeys, type UserQueryKey } from '@openfort/react'
 *
 * const key: UserQueryKey = openfortKeys.user()
 * ```
 */
export type UserQueryKey = ReturnType<typeof openfortKeys.user>

/**
 * The cache key the embedded-accounts query reads and writes.
 *
 * @example
 * ```ts
 * import { openfortKeys, type EmbeddedAccountsQueryKey } from '@openfort/react'
 *
 * const key: EmbeddedAccountsQueryKey = openfortKeys.embeddedAccounts()
 * ```
 */
export type EmbeddedAccountsQueryKey = ReturnType<typeof openfortKeys.embeddedAccounts>

/**
 * What {@link getUserQueryOptions} returns.
 *
 * The key is tagged with its payload, so `queryClient.getQueryData(key)` and
 * `setQueryData` are typed as `User` without a manual type argument.
 *
 * @example
 * ```ts
 * import { getUserQueryOptions, type UserQueryOptions } from '@openfort/react'
 * import type { Openfort } from '@openfort/openfort-js'
 *
 * const optionsFor = (client: Openfort): UserQueryOptions => getUserQueryOptions(client)
 * ```
 */
export type UserQueryOptions = UnusedSkipTokenOptions<User, DefaultError, User, UserQueryKey> & {
  queryKey: DataTag<UserQueryKey, User, DefaultError>
}

/**
 * What {@link getEmbeddedAccountsQueryOptions} returns.
 *
 * The key is tagged with its payload, so `queryClient.getQueryData(key)` and
 * `setQueryData` are typed as `EmbeddedAccount[]` without a manual type argument.
 *
 * @example
 * ```ts
 * import {
 *   getEmbeddedAccountsQueryOptions,
 *   type EmbeddedAccountsQueryOptions,
 * } from '@openfort/react'
 * import type { Openfort } from '@openfort/openfort-js'
 *
 * const optionsFor = (client: Openfort): EmbeddedAccountsQueryOptions =>
 *   getEmbeddedAccountsQueryOptions(client)
 * ```
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
 *
 * @example
 * ```tsx
 * import { getUserQueryOptions } from '@openfort/react'
 * import { useQuery } from '@tanstack/react-query'
 * import type { Openfort } from '@openfort/openfort-js'
 *
 * export function useCurrentUser(client: Openfort) {
 *   return useQuery(getUserQueryOptions(client))
 * }
 * ```
 */
export function getUserQueryOptions(client: Openfort): UserQueryOptions {
  return queryOptions({
    queryKey: openfortKeys.user(getOpenfortQueryScope(client)),
    queryFn: () => fetchUser(client),
    staleTime: 30_000,
    retry: false,
  })
}

/**
 * Query options for the user's embedded wallet accounts.
 *
 * Shares its key and fetcher with the provider, which publishes every account
 * list it loads to this cache entry.
 *
 * @example
 * ```tsx
 * import { getEmbeddedAccountsQueryOptions } from '@openfort/react'
 * import { useQuery } from '@tanstack/react-query'
 * import type { Openfort } from '@openfort/openfort-js'
 *
 * export function useEmbeddedAccounts(client: Openfort) {
 *   return useQuery(getEmbeddedAccountsQueryOptions(client))
 * }
 * ```
 */
export function getEmbeddedAccountsQueryOptions(client: Openfort): EmbeddedAccountsQueryOptions {
  return queryOptions({
    queryKey: openfortKeys.embeddedAccounts(getOpenfortQueryScope(client)),
    queryFn: () => fetchEmbeddedAccounts(client),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

type WalletAssetsChainConfig = {
  chainId: number
  assets: readonly string[]
  rpcUrl?: string
}

function canonicalizeWalletAssetChains(
  chains: readonly WalletAssetsChainConfig[] | undefined
): readonly WalletAssetsChainKeyConfig[] {
  if (!chains) return []
  return chains
    .map(({ chainId, assets, rpcUrl }) => ({
      chainId,
      assets: (Array.isArray(assets) ? assets : [])
        .filter((asset): asset is string => typeof asset === 'string')
        .map((asset) => asset.toLowerCase())
        .sort(),
      ...(rpcUrl && { rpcScope: getOpenfortQueryInputScope(rpcUrl) }),
    }))
    .sort((left, right) => left.chainId - right.chainId)
}

/**
 * Key and enablement for an Ethereum wallet-assets query.
 *
 * Assets can only be read once an address is known, and — outside multi-chain
 * mode — once the chain is known too, so both are required rather than asserted.
 */
export function getWalletAssetsQueryScope(params: {
  client: object
  address: string | undefined
  chainId: number | undefined
  multiChain: boolean
  assets: readonly string[]
  hasChain: boolean
  backendUrl: string
  rpcUrl?: string
  assetFilter?: readonly WalletAssetsChainConfig[]
  fallbackChains?: readonly WalletAssetsChainConfig[]
}) {
  const { client, address, chainId, multiChain, assets, hasChain, backendUrl, rpcUrl, assetFilter, fallbackChains } =
    params
  const enabled = multiChain ? !!address : !!address && !!chainId && hasChain
  const keyParams: WalletAssetsKeyParams = {
    address: address?.toLowerCase() ?? '',
    chainType: ChainTypeEnum.EVM,
    multiChain,
    clientScope: getOpenfortQueryScope(client),
    chainId: multiChain ? undefined : chainId,
    backendScope: getOpenfortQueryInputScope(backendUrl),
    rpcScope: multiChain ? undefined : getOpenfortQueryInputScope(rpcUrl),
    assets: multiChain
      ? undefined
      : (Array.isArray(assets) ? assets : [])
          .filter((asset): asset is string => typeof asset === 'string')
          .map((asset) => asset.toLowerCase())
          .sort(),
    assetFilter: multiChain ? canonicalizeWalletAssetChains(assetFilter) : undefined,
    fallbackChains: multiChain ? canonicalizeWalletAssetChains(fallbackChains) : undefined,
  }
  return { queryKey: openfortKeys.walletAssets(keyParams), enabled }
}
