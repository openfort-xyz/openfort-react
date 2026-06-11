'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect } from 'react'
import { createPublicClient, formatEther, http } from 'viem'
import { useOpenfort } from '../components/Openfort/useOpenfort'
import { DEFAULT_TESTNET_CHAIN_ID } from '../core/ConnectionStrategy'
import { useAsyncData } from '../shared/hooks/useAsyncData'
import { formatSol } from '../solana/hooks/utils'
import type { SolanaCluster } from '../solana/types'
import { getDefaultEthereumRpcUrl, getDefaultSolanaRpcUrl, getNativeCurrency } from '../utils/rpc'

/** Event name for balance invalidation. Call invalidateBalance() after balance-changing txs. */
export const BALANCE_INVALIDATE_EVENT = 'openfort:balance-invalidate'

/** Dispatches balance invalidation so all useBalance instances refetch. Call after mint/send. */
export function invalidateBalance(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BALANCE_INVALIDATE_EVENT))
  }
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

  const { data, error, isLoading, refetch } = useAsyncData({
    queryKey: ['balance', chainType, address, chainId, cluster],
    queryFn: () =>
      chainType === ChainTypeEnum.EVM
        ? fetchEvmBalance(address, rpcUrl, chainId)
        : fetchSolanaBalance(address, rpcUrl, commitment),
    enabled: isEnabled,
    refetchInterval,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!isEnabled) return
    const handler = () => refetch().catch(() => {})
    window.addEventListener(BALANCE_INVALIDATE_EVENT, handler)
    return () => window.removeEventListener(BALANCE_INVALIDATE_EVENT, handler)
  }, [isEnabled, refetch])

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
