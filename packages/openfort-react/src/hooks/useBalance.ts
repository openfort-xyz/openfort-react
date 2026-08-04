'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createPublicClient, formatEther, http } from 'viem'
import { useOpenfort } from '../components/Openfort/useOpenfort.js'
import { DEFAULT_TESTNET_CHAIN_ID } from '../core/ConnectionStrategy.js'
import { useOpenfortCore } from '../openfort/useOpenfort.js'
import { getOpenfortQueryScope, openfortKeys } from '../query/queryKeys.js'
import { useQuery } from '../query/useQuery.js'
import { formatSol } from '../solana/hooks/utils.js'
import type { SolanaCluster } from '../solana/types.js'
import { getDefaultEthereumRpcUrl, getDefaultSolanaRpcUrl, getNativeCurrency } from '../utils/rpc.js'

/**
 * Returns a callback that marks every native balance and wallet-asset query
 * stale, so anything showing a balance refetches. Call it after a transaction
 * that moves funds (mint, send, deposit).
 *
 * @example
 * ```tsx
 * import { useInvalidateBalance } from '@openfort/react'
 *
 * function RefreshBalancesButton() {
 *   const invalidateBalance = useInvalidateBalance()
 *   return <button onClick={invalidateBalance}>Refresh balances</button>
 * }
 * ```
 */
export function useInvalidateBalance(): () => void {
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: openfortKeys.balance() })
    queryClient.invalidateQueries({ queryKey: openfortKeys.walletAssets() })
  }, [queryClient])
}

type BalanceState =
  | { status: 'idle'; refetch: () => void }
  | { status: 'loading'; refetch: () => void }
  | { status: 'error'; error: Error; refetch: () => void }
  | { status: 'success'; value: bigint; formatted: string; symbol: string; decimals: number; refetch: () => void }

interface UseBalanceOptions {
  /** Address to fetch balance for */
  address: string
  /** Chain type */
  chainType: ChainTypeEnum
  /** Ethereum chain ID (default: 84532 Base Sepolia) */
  chainId?: number
  /** Solana cluster (default: devnet) */
  cluster?: SolanaCluster
  /** Solana commitment level (default: confirmed) */
  commitment?: 'processed' | 'confirmed' | 'finalized'
  /** Enable/disable the query */
  enabled?: boolean
  /** Refetch interval in ms (default: 30000) */
  refetchInterval?: number
}

type BalanceResult = { value: bigint; formatted: string; symbol: string; decimals: number }

async function fetchEvmBalance(address: string, rpcUrl: string, chainId: number): Promise<BalanceResult> {
  const client = createPublicClient({ transport: http(rpcUrl) })
  const balance = await client.getBalance({ address: address as `0x${string}` })
  const { symbol, decimals } = getNativeCurrency(chainId)
  return { value: balance, formatted: formatEther(balance), symbol, decimals }
}

export async function fetchSolanaBalance(
  addressStr: string,
  rpcUrl: string,
  commitment: 'processed' | 'confirmed' | 'finalized'
): Promise<BalanceResult> {
  const { address, createSolanaRpc } = await import('@solana/kit')
  const rpc = createSolanaRpc(rpcUrl)
  const { value: lamports } = await rpc.getBalance(address(addressStr), { commitment }).send()
  return {
    value: BigInt(lamports),
    formatted: formatSol(BigInt(lamports), 9),
    symbol: 'SOL',
    decimals: 9,
  }
}

/** Hook for fetching native token balance. */
export function useBalance(options: UseBalanceOptions): BalanceState {
  const client = useOpenfortCore((state) => state.client)
  const {
    address,
    chainType,
    chainId = DEFAULT_TESTNET_CHAIN_ID,
    cluster = 'devnet',
    commitment = 'confirmed',
    enabled = true,
    refetchInterval = 30_000,
  } = options

  const { walletConfig } = useOpenfort()
  const rpcUrl =
    chainType === ChainTypeEnum.EVM
      ? (walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId))
      : (walletConfig?.solana?.rpcUrls?.[cluster] ?? getDefaultSolanaRpcUrl(cluster))

  const isEnabled = enabled && !!address && address.length > 0

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: openfortKeys.balance(
      chainType === ChainTypeEnum.EVM
        ? { address, chainType, clientScope: getOpenfortQueryScope(client), chainId, rpcUrl }
        : { address, chainType, clientScope: getOpenfortQueryScope(client), cluster, rpcUrl, commitment }
    ),
    queryFn: () =>
      chainType === ChainTypeEnum.EVM
        ? fetchEvmBalance(address, rpcUrl, chainId)
        : fetchSolanaBalance(address, rpcUrl, commitment),
    enabled: isEnabled,
    refetchInterval,
    staleTime: 30_000,
  })

  if (!isEnabled) {
    return { status: 'idle', refetch }
  }

  if (isLoading) {
    return { status: 'loading', refetch }
  }

  if (error) {
    return { status: 'error', error, refetch }
  }

  return {
    status: 'success',
    value: data?.value ?? BigInt(0),
    formatted: data?.formatted ?? '0',
    symbol: data?.symbol ?? '',
    decimals: data?.decimals ?? 18,
    refetch,
  }
}
