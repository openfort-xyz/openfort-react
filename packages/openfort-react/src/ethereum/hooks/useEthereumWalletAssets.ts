'use client'

import { useCallback, useMemo } from 'react'
import type { Transport } from 'viem'
import { createWalletClient, custom, formatUnits, numberToHex } from 'viem'
import { erc7811Actions } from 'viem/experimental'
import type { getAssets } from 'viem/experimental/erc7811'
import type { Asset, MultiChainAsset } from '../../components/Openfort/types'
import { useOpenfortUIContext as useOpenfort } from '../../components/Openfort/useOpenfort'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import type { EthereumConfig } from '../../ethereum/types'
import { useUser } from '../../hooks/openfort/useUser'
import { openfortKeys } from '../../query/queryKeys'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { useEthereumEmbeddedWallet } from './useEthereumEmbeddedWallet'

type UseEthereumWalletAssetsOptions = {
  assets?: EthereumConfig['assets']
  /** When true, fetches assets for all configured chains and returns MultiChainAsset[]. */
  multiChain?: boolean
  staleTime?: number
}

type WalletAssetsReturnBase = {
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isIdle: boolean
  error: OpenfortError | undefined
  refetch: () => Promise<unknown>
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
        throw new OpenfortError(
          'Failed to get access token from third party auth provider',
          OpenfortReactErrorType.AUTHENTICATION_ERROR
        )
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
            throw new Error(data.error.message)
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

  const { data, error, isLoading, refetch } = useAsyncData({
    queryKey: multiChain
      ? ['wallet-assets', 'multi', address, customAssetsMultiChain]
      : [...openfortKeys.walletAssets(chainId!, customAssetsToFetch, address)],
    queryFn: async (): Promise<readonly Asset[] | readonly MultiChainAsset[]> => {
      if (multiChain) {
        if (!address) {
          throw new OpenfortError('No wallet address available', OpenfortReactErrorType.UNEXPECTED_ERROR)
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
        allAssets.sort((a, b) => getUsdValue(b) - getUsdValue(a))
        return allAssets as readonly MultiChainAsset[]
      }

      // Single-chain path
      if (!address || !chainId || !chain) {
        throw new OpenfortError('Wallet not connected', OpenfortReactErrorType.UNEXPECTED_ERROR, {
          error: new Error('Address, chainId, or chain not available'),
        })
      }

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
            metadata: meta?.fiat ? { symbol: meta.symbol ?? '', decimals: meta.decimals, fiat: meta.fiat } : undefined,
            raw: a,
          }
        } else {
          throw new OpenfortError('Unsupported asset type', OpenfortReactErrorType.UNEXPECTED_ERROR, { error: a })
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

      return mergedAssets as readonly Asset[]
    },
    enabled: multiChain ? isConnected && !!address : isConnected && !!chainId && !!chain && !!address,
    staleTime,
  })

  const mappedError = useMemo(() => {
    if (!error) return undefined

    if (error instanceof OpenfortError) {
      return error
    }

    return new OpenfortError('Failed to fetch wallet assets', OpenfortReactErrorType.UNEXPECTED_ERROR, { error })
  }, [error])

  return {
    data: data ?? null,
    multiChain,
    isLoading,
    isError: !!error,
    isSuccess: !!data && !error,
    isIdle: multiChain ? !address : !isConnected || !chainId || !chain,
    error: mappedError,
    refetch,
  } as UseEthereumWalletAssetsResult
}
