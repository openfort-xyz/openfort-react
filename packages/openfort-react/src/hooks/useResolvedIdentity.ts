'use client'

/**
 * useResolvedIdentity Hook
 *
 * Resolve ENS names and avatars using viem.
 * Uses discriminated union for type-safe status handling.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { useOpenfort } from '../components/Openfort/useOpenfort.js'
import { useAsyncData } from '../shared/hooks/useAsyncData.js'
import { getDefaultEthereumRpcUrl } from '../utils/rpc.js'

/**
 * Resolved identity state - discriminated union
 */
type ResolvedIdentity =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; name: string | null; avatar: string | null }

interface UseResolvedIdentityOptions {
  /** Address to resolve (empty string if not available yet) */
  address: string
  /** Chain type for resolution */
  chainType?: ChainTypeEnum
  /** ENS chain ID. Only chainId 1 (mainnet) supports ENS. Default 0 = do not resolve. */
  ensChainId?: number
  /** Enable/disable the query (for conditional fetching without breaking React rules) */
  enabled?: boolean
}

async function resolveEthereumIdentity(
  address: string,
  rpcUrl: string
): Promise<{ name: string | null; avatar: string | null }> {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })
  const name = await client.getEnsName({ address: address as `0x${string}` })
  const avatar = name ? await client.getEnsAvatar({ name: normalize(name) }) : null
  return { name, avatar }
}

/**
 * Hook for resolving addresses to ENS names and avatars.
 *
 * Uses viem for ENS resolution. Supports Solana name services in the future.
 *
 * @example Basic usage
 * ```tsx
 * function Profile({ address }: { address: string }) {
 *   const identity = useResolvedIdentity({ address });
 *
 *   switch (identity.status) {
 *     case 'idle':
 *       return null;
 *     case 'loading':
 *       return <p>Resolving...</p>;
 *     case 'error':
 *       return <p>Error: {identity.error.message}</p>;
 *     case 'success':
 *       return (
 *         <div>
 *           {identity.avatar && <img src={identity.avatar} alt="Avatar" />}
 *           <p>{identity.name ?? address}</p>
 *         </div>
 *       );
 *   }
 * }
 * ```
 *
 * @example With enabled option
 * ```tsx
 * const identity = useResolvedIdentity({
 *   address: wallet.status === 'connected' ? wallet.address : '',
 *   enabled: wallet.status === 'connected',
 * });
 * ```
 */
export function useResolvedIdentity(options: UseResolvedIdentityOptions): ResolvedIdentity {
  const { address, chainType = ChainTypeEnum.EVM, ensChainId = 0, enabled = true } = options

  const { walletConfig } = useOpenfort()
  // Only resolve RPC URL for mainnet (ensChainId === 1) — chainId 0 means "do not resolve"
  const rpcUrl =
    ensChainId === 1
      ? (walletConfig?.ethereum?.rpcUrls?.[ensChainId] ?? getDefaultEthereumRpcUrl(ensChainId))
      : undefined

  const isEnabled = enabled && !!address && address.length > 0 && ensChainId === 1 && !!rpcUrl

  const { data, error, isLoading } = useAsyncData({
    queryKey: ['identity', chainType, address, ensChainId],
    queryFn: () => resolveEthereumIdentity(address, rpcUrl!),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  })

  // Discriminated union return - status-based
  if (!isEnabled) {
    return { status: 'idle' }
  }

  if (isLoading) {
    return { status: 'loading' }
  }

  if (error) {
    return { status: 'error', error }
  }

  return {
    status: 'success',
    name: data?.name ?? null,
    avatar: data?.avatar ?? null,
  }
}
