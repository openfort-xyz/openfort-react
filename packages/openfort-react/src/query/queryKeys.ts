import type { ChainTypeEnum } from '@openfort/openfort-js'

/** Identifies a single native-balance query. */
type BalanceKeyParams = {
  address: string
  chainType: ChainTypeEnum
  /** EVM only. */
  chainId?: number
  /** Solana only: the cluster name or RPC URL the balance is read from. */
  cluster?: string
}

/**
 * Identifies a single wallet-assets query. `chainId` is absent in multi-chain
 * mode and on Solana, where `rpcUrl` pins the cluster instead.
 */
export type WalletAssetsKeyParams = {
  address: string
  chainType: ChainTypeEnum
  multiChain: boolean
  chainId?: number
  rpcUrl?: string
  assets?: readonly string[]
}

/** Identifies a single ENS name/avatar resolution. */
type IdentityKeyParams = {
  address: string
  chainType: ChainTypeEnum
  ensChainId: number
}

/** Identifies a single funding-rail chain listing. */
type FundingChainsKeyParams = {
  baseUrl: string
  livemode: boolean
}

/**
 * Query key factory for every query the SDK owns.
 *
 * Each parameterised factory also accepts no arguments, returning the prefix
 * shared by that family — pass it to `queryClient.invalidateQueries` to refresh
 * every query of that kind at once.
 *
 * @example
 * ```ts
 * queryClient.invalidateQueries({ queryKey: openfortKeys.balance() })
 * ```
 */
export const openfortKeys = {
  all: ['openfort'] as const,

  user: () => [...openfortKeys.all, 'user'] as const,

  embeddedAccounts: () => [...openfortKeys.all, 'embeddedAccounts'] as const,

  balance: (params?: BalanceKeyParams) => [...openfortKeys.all, 'balance', ...(params ? [params] : [])] as const,

  walletAssets: (params?: WalletAssetsKeyParams) =>
    [...openfortKeys.all, 'walletAssets', ...(params ? [params] : [])] as const,

  identity: (params?: IdentityKeyParams) => [...openfortKeys.all, 'identity', ...(params ? [params] : [])] as const,

  fundingChains: (params?: FundingChainsKeyParams) =>
    [...openfortKeys.all, 'fundingChains', ...(params ? [params] : [])] as const,
}
