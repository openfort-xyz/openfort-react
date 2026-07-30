'use client'

import { useCallback, useMemo } from 'react'
import type { Chain, Transport } from 'viem'
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, numberToHex } from 'viem'
import { erc7811Actions } from 'viem/experimental'
import type { getAssets } from 'viem/experimental/erc7811'
import type { Asset, MultiChainAsset } from '../../components/Openfort/types.js'
import { useOpenfortUIContext as useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { NotAuthenticatedError } from '../../errors/auth.js'
import { OpenfortError, toError } from '../../errors/base.js'
import { ApiRequestError, UnsupportedOperationError } from '../../errors/operation.js'
import { WalletNotConnectedError } from '../../errors/wallet.js'
import type { EthereumConfig } from '../../ethereum/types.js'
import { useUser } from '../../hooks/openfort/useUser.js'
import { getWalletAssetsQueryScope } from '../../query/queryOptions.js'
import { type UseQueryReturnType, useQuery } from '../../query/useQuery.js'
import { getDefaultEthereumRpcUrl } from '../../utils/rpc.js'
import { useEthereumEmbeddedWallet } from './useEthereumEmbeddedWallet.js'

type UseEthereumWalletAssetsOptions = {
  assets?: EthereumConfig['assets']
  /** When true, fetches assets for all configured chains and returns MultiChainAsset[]. */
  multiChain?: boolean
  staleTime?: number
}

type WalletAssetsQueryResult = UseQueryReturnType<readonly Asset[] | readonly MultiChainAsset[], Error>

/**
 * The TanStack query result, with three Openfort-specific overrides: `data` is
 * `null` rather than `undefined` before the first result, `error` is normalised
 * to an {@link OpenfortError}, and `isIdle` reports that the query is gated off
 * because no wallet/chain is available yet.
 */
type WalletAssetsReturnBase = Omit<WalletAssetsQueryResult, 'data' | 'error'> & {
  isIdle: boolean
  error: OpenfortError | undefined
}

type UseEthereumWalletAssetsResult =
  | (WalletAssetsReturnBase & { multiChain: true; data: readonly MultiChainAsset[] | null })
  | (WalletAssetsReturnBase & { multiChain: false; data: readonly Asset[] | null })

function getUsdValue(asset: Asset): number {
  const fiat = asset.metadata?.fiat
  if (!fiat?.value || asset.balance === undefined) return 0
  const decimals = asset.metadata?.decimals ?? 18
  const amount = Number.parseFloat(formatUnits(asset.balance, decimals))
  return Number.isFinite(amount) ? amount * fiat.value : 0
}

/** Stablecoins approximated at $1 in fallback mode (no price feed available). */
const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'DAI'])

/**
 * Canonical Multicall3 address — same on every major chain. Passed explicitly so
 * multicall works even when the SDK's chain config doesn't declare a multicall3.
 */
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

/**
 * Reads native + configured ERC-20 balances directly from the chain RPC.
 *
 * Fallback for when Openfort's ERC-7811 asset proxy is unavailable: the widget
 * still shows on-chain balances (no fiat valuation — that comes from the proxy,
 * except stablecoins which are approximated at $1). Tokens that don't exist on
 * the chain are skipped.
 */
async function readEvmAssetsViaRpc(args: {
  address: `0x${string}`
  chain: Chain
  rpcUrl: string
  tokens: readonly `0x${string}`[]
}): Promise<Asset[]> {
  const { address, chain, rpcUrl, tokens } = args
  const client = createPublicClient({ chain, transport: http(rpcUrl) })
  const out: Asset[] = []

  // Native balance — one call. Skipped silently if it fails (best-effort).
  try {
    const native = await client.getBalance({ address })
    out.push({
      type: 'native',
      address: 'native',
      balance: native,
      metadata: {
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals,
        fiat: { value: 0, currency: 'USD' },
      },
    })
  } catch {
    // native read failed for this chain — skip it
  }

  if (tokens.length === 0) return out

  // Batch every token's balanceOf/decimals/symbol/name into ONE multicall request
  // (via Multicall3) instead of 4 calls per token — keeps us well under public-RPC
  // rate limits (429s) that previously broke the fallback.
  const contracts = tokens.flatMap((token) => [
    { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] } as const,
    { address: token, abi: erc20Abi, functionName: 'decimals' } as const,
    { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
    { address: token, abi: erc20Abi, functionName: 'name' } as const,
  ])

  try {
    const results = await client.multicall({ contracts, allowFailure: true, multicallAddress: MULTICALL3_ADDRESS })
    tokens.forEach((token, i) => {
      const balance = results[i * 4]
      const decimals = results[i * 4 + 1]
      const symbol = results[i * 4 + 2]
      const name = results[i * 4 + 3]
      if (balance?.status !== 'success' || decimals?.status !== 'success' || symbol?.status !== 'success') return

      const sym = symbol.result as string
      out.push({
        type: 'erc20',
        address: token,
        balance: balance.result as bigint,
        metadata: {
          name: (name?.status === 'success' ? name.result : sym) as string,
          symbol: sym,
          decimals: decimals.result as number,
          // No price feed in fallback mode; approximate stablecoins at $1 so the
          // USD total isn't blank. Other tokens show their amount without a value.
          fiat: STABLECOIN_SYMBOLS.has(sym.toUpperCase()) ? { value: 1, currency: 'USD' } : undefined,
        },
      })
    })
  } catch {
    // Multicall request itself failed (RPC throttled, or no Multicall3 on the chain).
    // Return whatever we have (native) rather than throwing away the whole fetch.
  }

  return out
}

/**
 * Returns wallet assets (tokens, NFTs) for the connected Ethereum address.
 * Uses ERC-7811 via Openfort's authenticated RPC proxy.
 *
 * When `multiChain` is true, fetches assets across all configured chains
 * via `wallet_getAssets` and returns `MultiChainAsset[]` (assets tagged with `chainId`).
 *
 * @param options - Optional custom assets config, multiChain flag, and staleTime
 * @returns assets, isLoading, error, refetch
 *
 * @example
 * ```tsx
 * const { data: assets, isLoading } = useEthereumWalletAssets()
 * // Multi-chain:
 * const { data, multiChain } = useEthereumWalletAssets({ multiChain: true })
 * ```
 */
export const useEthereumWalletAssets = ({
  assets: hookCustomAssets,
  multiChain = false,
  staleTime = 30000,
}: UseEthereumWalletAssetsOptions = {}): UseEthereumWalletAssetsResult => {
  const wallet = useEthereumEmbeddedWallet()
  const isConnected = wallet.status === 'connected'
  const address = isConnected ? wallet.address : undefined
  const chainId = isConnected ? wallet.chainId : undefined

  const { walletConfig, publishableKey, overrides, thirdPartyAuth, chains } = useOpenfort()
  const { getAccessToken } = useUser()
  const chain = chains.find((c) => c.id === chainId)
  const backendUrl = overrides?.backendUrl || 'https://api.openfort.io'

  const buildHeaders = useCallback(async () => {
    if (thirdPartyAuth) {
      const accessToken = await thirdPartyAuth.getAccessToken()

      if (!accessToken) {
        throw new NotAuthenticatedError('Failed to get access token from third party auth provider.')
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-auth-provider': thirdPartyAuth.provider,
        'x-player-token': accessToken,
        'x-token-type': 'idToken',
        Authorization: `Bearer ${publishableKey}`,
      }
      return headers
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-project-key': publishableKey,
      Authorization: `Bearer ${await getAccessToken()}`,
    }
    return headers
  }, [publishableKey, getAccessToken, thirdPartyAuth])

  /** For multiChain: walletConfig.ethereum.assets as backend assetFilter format (hex chainId -> [{ address, type }]). */
  const customAssetsMultiChain = useMemo(() => {
    if (!multiChain) return undefined
    const configAssets = walletConfig?.ethereum?.assets
    if (!configAssets) return undefined
    const mapped: Record<string, { address: string; type: string }[]> = {}
    for (const [cid, addresses] of Object.entries(configAssets)) {
      const hexChainId = numberToHex(Number(cid))
      mapped[hexChainId] = addresses.map((addr) => ({ address: addr, type: 'erc20' }))
    }
    return Object.keys(mapped).length > 0 ? mapped : undefined
  }, [multiChain, walletConfig?.ethereum?.assets])

  const customTransport = useMemo(
    () => (): Transport => {
      return custom({
        async request({ method, params }) {
          const res = await fetch(`${backendUrl}/rpc`, {
            method: 'POST',
            headers: await buildHeaders(),
            body: JSON.stringify({
              method,
              params: params[0],
              id: 1,
              jsonrpc: '2.0',
            }),
          })

          const data = await res.json()

          if (data.error) {
            throw new ApiRequestError({ operation: 'Wallet asset lookup', body: data.error.message })
          }

          return data.result
        },
      })
    },
    [buildHeaders, backendUrl]
  )

  const customAssetsToFetch = useMemo(() => {
    if (!chainId) return []
    const assetsFromConfig = walletConfig?.ethereum?.assets ? walletConfig.ethereum.assets[chainId] || [] : []
    const assetsFromHook = hookCustomAssets ? hookCustomAssets[chainId] || [] : []
    const allAssets = [...assetsFromConfig, ...assetsFromHook]
    return allAssets
  }, [walletConfig?.ethereum?.assets, hookCustomAssets, chainId])

  const multiChainAssetAddresses = useMemo(
    () => (customAssetsMultiChain ? Object.values(customAssetsMultiChain).flatMap((a) => a.map((x) => x.address)) : []),
    [customAssetsMultiChain]
  )

  const { queryKey, enabled } = getWalletAssetsQueryScope({
    address,
    chainId,
    multiChain,
    assets: multiChain ? multiChainAssetAddresses : customAssetsToFetch,
    hasChain: !!chain,
  })

  const { data, error, ...query } = useQuery({
    queryKey,
    queryFn: async (): Promise<readonly Asset[] | readonly MultiChainAsset[]> => {
      if (multiChain) {
        if (!address) {
          throw new WalletNotConnectedError('No wallet address available.')
        }
        const headers = await buildHeaders()
        const defaultRequest = fetch(`${backendUrl}/rpc`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            method: 'wallet_getAssets',
            params: { account: address },
            id: 1,
            jsonrpc: '2.0',
          }),
        })
        const customRequest = customAssetsMultiChain
          ? fetch(`${backendUrl}/rpc`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                method: 'wallet_getAssets',
                params: { account: address, assetFilter: customAssetsMultiChain },
                id: 2,
                jsonrpc: '2.0',
              }),
            })
          : null
        const responses = await Promise.all([defaultRequest, customRequest].filter(Boolean) as Promise<Response>[])
        const [defaultData, customData] = await Promise.all(responses.map((r) => r.json()))
        if (defaultData?.error) {
          // ERC-7811 asset proxy failed — fall back to per-chain RPC reads.
          const out: MultiChainAsset[] = []
          for (const c of chains) {
            const tokens = (walletConfig?.ethereum?.assets?.[c.id] ?? []) as `0x${string}`[]
            const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[c.id] ?? getDefaultEthereumRpcUrl(c.id)
            const rpcAssets = await readEvmAssetsViaRpc({ address: address as `0x${string}`, chain: c, rpcUrl, tokens })
            for (const a of rpcAssets) out.push({ ...a, chainId: c.id })
          }
          return out as readonly MultiChainAsset[]
        }
        const result: Record<string, unknown[]> = { ...(defaultData.result ?? {}) }
        if (customData?.result && typeof customData.result === 'object') {
          for (const [chainKey, assets] of Object.entries(customData.result)) {
            if (!Array.isArray(assets)) continue
            if (!result[chainKey]) {
              result[chainKey] = assets
            } else {
              const existing = new Map((result[chainKey] as { address?: string }[]).map((a) => [a.address ?? '', a]))
              for (const asset of assets as { address?: string }[]) {
                existing.set(asset.address ?? '', asset)
              }
              result[chainKey] = Array.from(existing.values())
            }
          }
        }
        const allAssets: MultiChainAsset[] = []
        for (const [chainIdKey, assets] of Object.entries(result)) {
          const cid = Number(chainIdKey)
          if (!Array.isArray(assets)) continue
          for (const a of assets as {
            type: string
            address?: string
            balance?: string
            metadata?: unknown
          }[]) {
            if (a.type === 'erc20') {
              const asset: Asset = {
                type: 'erc20' as const,
                address: (a.address ?? '0x0') as `0x${string}`,
                balance: BigInt(a.balance ?? 0),
                metadata: {
                  name: (a.metadata as { name?: string } | undefined)?.name || 'Unknown Token',
                  symbol: (a.metadata as { symbol?: string } | undefined)?.symbol || 'UNKNOWN',
                  decimals: (a.metadata as { decimals?: number } | undefined)?.decimals,
                  fiat: (a.metadata as { fiat?: { value: number; currency: string } } | undefined)?.fiat,
                },
                raw: a as unknown as getAssets.Erc20Asset,
              }
              allAssets.push({ ...asset, chainId: cid })
            } else if (a.type === 'native') {
              const meta = (a.metadata ?? {}) as {
                symbol?: string
                decimals?: number
                fiat?: { value: number; currency: string }
              }
              const asset: Asset = {
                type: 'native' as const,
                address: 'native',
                balance: BigInt(a.balance ?? 0),
                metadata: {
                  symbol: meta.symbol || 'ETH',
                  decimals: meta.decimals,
                  fiat: meta.fiat ?? { value: 0, currency: 'USD' },
                },
                raw: a as unknown as getAssets.NativeAsset,
              }
              allAssets.push({ ...asset, chainId: cid })
            }
          }
        }
        // The ERC-7811 proxy indexes mainnet; testnet natives (e.g. Base Sepolia ETH)
        // come back missing or stale. For configured testnet chains, read the native
        // balance straight from RPC — the same source Rabby uses — and upsert it.
        const testnetChains = chains.filter((c) => c.testnet === true)
        const rpcNatives = await Promise.all(
          testnetChains.map(async (c) => {
            const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[c.id] ?? getDefaultEthereumRpcUrl(c.id)
            const read = await readEvmAssetsViaRpc({ address: address as `0x${string}`, chain: c, rpcUrl, tokens: [] })
            const native = read.find((a) => a.type === 'native')
            return native ? ({ ...native, chainId: c.id } as MultiChainAsset) : null
          })
        )
        for (const native of rpcNatives) {
          if (!native) continue
          const idx = allAssets.findIndex((a) => a.type === 'native' && a.chainId === native.chainId)
          if (idx >= 0) allAssets[idx] = native
          else allAssets.push(native)
        }
        allAssets.sort((a, b) => getUsdValue(b) - getUsdValue(a))
        return allAssets as readonly MultiChainAsset[]
      }

      // Single-chain path
      if (!address || !chainId || !chain) {
        throw new WalletNotConnectedError('Wallet not connected.', {
          details: 'Address, chainId, or chain not available.',
        })
      }

      try {
        const customClient = createWalletClient({
          account: address as `0x${string}`,
          chain,
          transport: customTransport(),
        })

        const extendedClient = customClient.extend(erc7811Actions())

        const defaultAssetsPromise = extendedClient.getAssets({
          chainIds: [chainId],
        })

        const hexChainId = numberToHex(chainId)
        const customAssetsPromise =
          customAssetsToFetch.length > 0
            ? extendedClient.getAssets({
                chainIds: [chainId],
                assets: {
                  [hexChainId]: customAssetsToFetch.map((a) => ({
                    address: a,
                    type: 'erc20' as const,
                  })),
                },
              })
            : Promise.resolve({ [hexChainId]: [] as getAssets.Asset<false>[] })

        const [defaultAssetsRaw, customAssets] = await Promise.all([defaultAssetsPromise, customAssetsPromise])

        // ERC-7811 response keys may be hex (e.g. "0x14a34") or numeric depending on the RPC
        const rawByChain = defaultAssetsRaw as unknown as Record<string, getAssets.Asset<false>[]>
        const customByChain = customAssets as unknown as Record<string, getAssets.Asset<false>[]>

        const rawChainAssets = rawByChain[hexChainId] ?? rawByChain[String(chainId)] ?? []
        const customChainAssets = customByChain[hexChainId] ?? customByChain[String(chainId)] ?? []

        const defaultAssets = rawChainAssets.map<Asset>((a) => {
          let asset: Asset
          if (a.type === 'erc20') {
            type ExtendedMeta = {
              name?: string
              symbol?: string
              decimals?: number
              fiat?: Asset['metadata'] extends { fiat?: infer F } ? F : never
            }
            const meta = a.metadata as ExtendedMeta | undefined
            asset = {
              type: 'erc20' as const,
              address: a.address,
              balance: a.balance,
              metadata: {
                name: meta?.name || 'Unknown Token',
                symbol: meta?.symbol || 'UNKNOWN',
                decimals: meta?.decimals,
                fiat: meta?.fiat,
              },
              raw: a,
            }
          } else if (a.type === 'native') {
            type ExtendedNativeMeta = { symbol?: string; decimals?: number; fiat?: { value: number; currency: string } }
            const meta = a.metadata as ExtendedNativeMeta | undefined
            asset = {
              type: 'native' as const,
              address: 'native',
              balance: a.balance,
              metadata: meta?.fiat
                ? { symbol: meta.symbol ?? '', decimals: meta.decimals, fiat: meta.fiat }
                : undefined,
              raw: a,
            }
          } else {
            throw new UnsupportedOperationError({ operation: `Asset type "${a.type}"` })
          }
          return asset
        })

        const mergedAssets = [...defaultAssets]
        const customAssetsForChain: Asset[] = customChainAssets.flatMap((asset: getAssets.Asset<false>) => {
          if (asset.type !== 'erc20') return []
          if (!walletConfig?.ethereum?.assets) return [{ ...asset, raw: asset }]

          const configAsset = walletConfig.ethereum.assets[chainId]?.find(
            (a) => a.toLowerCase() === asset.address.toLowerCase()
          )
          if (!configAsset) return [{ ...asset, raw: asset }]

          return [
            {
              type: 'erc20' as const,
              address: asset.address,
              balance: asset.balance,
              metadata: asset.metadata,
              raw: asset,
            } satisfies Asset,
          ]
        })

        customAssetsForChain.forEach((asset) => {
          if (!mergedAssets.find((a) => a.address === asset.address)) {
            mergedAssets.push(asset)
          }
        })

        // The ERC-7811 proxy indexes mainnet; a testnet native (e.g. Base Sepolia
        // ETH) comes back missing or stale, so the single-chain path would report
        // "no assets" while the multi-chain inventory shows the balance. Read the
        // native straight from RPC and upsert it to keep the two consistent.
        if (chain.testnet === true) {
          const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId)
          const read = await readEvmAssetsViaRpc({ address: address as `0x${string}`, chain, rpcUrl, tokens: [] })
          const native = read.find((a) => a.type === 'native')
          if (native) {
            const idx = mergedAssets.findIndex((a) => a.type === 'native')
            if (idx >= 0) mergedAssets[idx] = native
            else mergedAssets.unshift(native)
          }
        }

        if (mergedAssets.length === 0 && customAssetsToFetch.length > 0) {
          // Proxy succeeded but returned nothing while we expect tokens — read direct.
          const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId)
          const fb = await readEvmAssetsViaRpc({
            address: address as `0x${string}`,
            chain,
            rpcUrl,
            tokens: customAssetsToFetch as `0x${string}`[],
          })
          if (fb.length > 0) return fb as readonly Asset[]
        }
        return mergedAssets as readonly Asset[]
      } catch {
        // ERC-7811 asset proxy failed — fall back to direct chain-RPC balance reads.
        const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId)
        return (await readEvmAssetsViaRpc({
          address: address as `0x${string}`,
          chain,
          rpcUrl,
          tokens: customAssetsToFetch as `0x${string}`[],
        })) as readonly Asset[]
      }
    },
    enabled: isConnected && enabled,
    staleTime,
  })

  const mappedError = useMemo(() => {
    if (!error) return undefined

    if (error instanceof OpenfortError) {
      return error
    }

    return new OpenfortError('Failed to fetch wallet assets.', { cause: toError(error) })
  }, [error])

  return {
    ...query,
    data: data ?? null,
    multiChain,
    isIdle: !isConnected || !enabled,
    error: mappedError,
  } as UseEthereumWalletAssetsResult
}
