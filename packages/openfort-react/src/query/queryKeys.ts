import type { ChainTypeEnum } from '@openfort/openfort-js'
import { keccak256, stringToBytes } from 'viem'

/** Identifies a single native-balance query. */
type BalanceKeyParams = {
  address: string
  chainType: ChainTypeEnum
  /** Opaque identity of the Openfort client that owns this account-derived query. */
  clientScope?: OpenfortQueryScope
  /** EVM only. */
  chainId?: number
  /** Opaque scope for the effective RPC endpoint. */
  rpcScope?: QueryInputScope
  /** Public factory input converted to an opaque scope before entering the key. */
  rpcUrl?: string
  /** Solana only: the cluster name or RPC URL the balance is read from. */
  cluster?: string
  /** Solana only. */
  commitment?: 'processed' | 'confirmed' | 'finalized'
}

type OpenfortQueryScope = string
type QueryInputScope = string

/** Canonical chain-specific inputs that affect an Ethereum asset response. */
export type WalletAssetsChainKeyConfig = {
  chainId: number
  assets: readonly string[]
  rpcScope?: QueryInputScope
}

const clientScopes = new WeakMap<object, OpenfortQueryScope>()
const namespaceCounterKey = Symbol.for('@openfort/react/query-scope-namespace-counter')
const sharedGlobal = globalThis as typeof globalThis & Record<symbol, number | undefined>
sharedGlobal[namespaceCounterKey] = (sharedGlobal[namespaceCounterKey] ?? 0) + 1
const scopeNamespace = `${Date.now().toString(36)}:${sharedGlobal[namespaceCounterKey].toString(36)}`
let nextClientScope = 0

/** Returns the stable cache scope assigned to one Openfort client instance. */
export function getOpenfortQueryScope(client: object): OpenfortQueryScope {
  const existing = clientScopes.get(client)
  if (existing) return existing

  const scope = `${scopeNamespace}:${++nextClientScope}`
  clientScopes.set(client, scope)
  return scope
}

/** Derives a deterministic non-plaintext cache fingerprint; it is not an authorization boundary. */
export function getOpenfortQueryInputScope(value: string | undefined): QueryInputScope | undefined {
  if (value === undefined) return undefined
  return keccak256(stringToBytes(value))
}

/**
 * Replaces a public URL input with its opaque scope, so an endpoint carrying an
 * API key never reaches the host application's cache in plaintext. An explicitly
 * supplied scope wins.
 */
function withInputScope<TParams extends object, TUrl extends keyof TParams, TScope extends keyof TParams>(
  params: TParams,
  urlKey: TUrl,
  scopeKey: TScope
): Omit<TParams, TUrl> {
  const { [urlKey]: url, ...safeParams } = params
  if (url === undefined || safeParams[scopeKey as unknown as keyof typeof safeParams] !== undefined) return safeParams
  return { ...safeParams, [scopeKey]: getOpenfortQueryInputScope(url as string) }
}

/**
 * Identifies a single wallet-assets query. `chainId` is absent in multi-chain
 * mode and on Solana, where `rpcScope` pins the cluster instead.
 */
export type WalletAssetsKeyParams = {
  address: string
  chainType: ChainTypeEnum
  multiChain: boolean
  /** Opaque identity of the Openfort client whose authenticated backend is queried. */
  clientScope?: OpenfortQueryScope
  chainId?: number
  /** Opaque scope for the effective Ethereum asset backend endpoint. */
  backendScope?: QueryInputScope
  /** Opaque scope for a direct RPC endpoint. */
  rpcScope?: QueryInputScope
  /** Public factory input converted to an opaque scope before entering the key. */
  rpcUrl?: string
  assets?: readonly string[]
  /** Full chain-to-assets mapping sent to the multi-chain backend request. */
  assetFilter?: readonly WalletAssetsChainKeyConfig[]
  /** Chains, RPC endpoints and token lists used by the direct-RPC fallback. */
  fallbackChains?: readonly WalletAssetsChainKeyConfig[]
}

/** Identifies a single ENS name/avatar resolution. */
type IdentityKeyParams = {
  address: string
  chainType: ChainTypeEnum
  ensChainId: number
  /** Opaque scope for the effective identity RPC endpoint. */
  rpcScope?: QueryInputScope
  /** Public factory input converted to an opaque scope before entering the key. */
  rpcUrl?: string
}

/** Identifies a single funding-rail chain listing. */
type FundingChainsKeyParams = {
  /** Opaque scope for the funding backend. */
  baseScope?: QueryInputScope
  /** Public factory input converted to an opaque scope before entering the key. */
  baseUrl?: string
  livemode: boolean
}

type Erc20BalanceKeyParams = {
  clientScope: OpenfortQueryScope
  address: string
  token: string
  chainId: number
  rpcScope: QueryInputScope
}

type TransactionReceiptKeyParams = {
  clientScope: OpenfortQueryScope
  hash: string
  chainId: number
  rpcScope: QueryInputScope
}

type SolanaFeeKeyParams = {
  clientScope: OpenfortQueryScope
  address: string
  recipient: string
  rpcScope: QueryInputScope
}

type GasEstimateKeyParams = {
  clientScope: OpenfortQueryScope
  account: string
  to: string
  value?: bigint
  data?: string
  chainId: number
  rpcScope: QueryInputScope
}

/**
 * Renders the transfer amount as a string.
 *
 * A query key ends up in whatever the host application does with its cache, and
 * `OpenfortProvider` reuses the application's `QueryClient` when one is in
 * scope. A raw `bigint` there makes `JSON.stringify` throw, so a consumer using
 * `persistQueryClient` loses persistence for its own queries too.
 */
function sanitizeGasEstimateKeyParams(
  params: GasEstimateKeyParams
): Omit<GasEstimateKeyParams, 'value'> & { value?: string } {
  const { value, ...safeParams } = params
  return { ...safeParams, ...(value === undefined ? {} : { value: value.toString() }) }
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

  user: (scope?: OpenfortQueryScope) => [...openfortKeys.all, 'user', ...(scope ? [scope] : [])] as const,

  embeddedAccounts: (scope?: OpenfortQueryScope) =>
    [...openfortKeys.all, 'embeddedAccounts', ...(scope ? [scope] : [])] as const,

  balance: (params?: BalanceKeyParams) =>
    [...openfortKeys.all, 'balance', ...(params ? [withInputScope(params, 'rpcUrl', 'rpcScope')] : [])] as const,

  walletAssets: (params?: WalletAssetsKeyParams) =>
    [...openfortKeys.all, 'walletAssets', ...(params ? [withInputScope(params, 'rpcUrl', 'rpcScope')] : [])] as const,

  erc20Balance: (params?: Erc20BalanceKeyParams) =>
    [...openfortKeys.all, 'erc20Balance', ...(params ? [params] : [])] as const,

  transactionReceipt: (params?: TransactionReceiptKeyParams) =>
    [...openfortKeys.all, 'transactionReceipt', ...(params ? [params] : [])] as const,

  solanaFee: (params?: SolanaFeeKeyParams) => [...openfortKeys.all, 'solanaFee', ...(params ? [params] : [])] as const,

  gasEstimate: (params?: GasEstimateKeyParams) =>
    [...openfortKeys.all, 'gasEstimate', ...(params ? [sanitizeGasEstimateKeyParams(params)] : [])] as const,

  identity: (params?: IdentityKeyParams) =>
    [...openfortKeys.all, 'identity', ...(params ? [withInputScope(params, 'rpcUrl', 'rpcScope')] : [])] as const,

  fundingChains: (params?: FundingChainsKeyParams) =>
    [
      ...openfortKeys.all,
      'fundingChains',
      ...(params ? [withInputScope(params, 'baseUrl', 'baseScope')] : []),
    ] as const,
}
