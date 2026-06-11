import { ChainTypeEnum } from '@openfort/react'
import type { SolanaCluster } from '@openfort/react/solana'
import { DEFAULT_EVM_CHAIN, EVM_CHAIN_BY_ID, SOLANA_CLUSTER } from '@/lib/chains'

type ExplorerUrlOptions = {
  address?: string
  txHash?: string
  chainId?: number
  cluster?: SolanaCluster
}

const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com'

function appendPath(base: string, options: { address?: string; txHash?: string }, queryParams?: string): string {
  let path = base
  if (options.address) path = `${base}/address/${options.address}`
  else if (options.txHash) path = `${base}/tx/${options.txHash}`
  return queryParams ? `${path}?${queryParams}` : path
}

export function getExplorerUrl(chainType: ChainTypeEnum, options: ExplorerUrlOptions): string {
  if (chainType === ChainTypeEnum.EVM) {
    const chainId = options.chainId ?? DEFAULT_EVM_CHAIN.id
    const base = EVM_CHAIN_BY_ID[chainId]?.explorerUrl ?? DEFAULT_EVM_CHAIN.explorerUrl
    return appendPath(base, options)
  }

  const cluster = options.cluster ?? SOLANA_CLUSTER
  const clusterParam = `cluster=${encodeURIComponent(cluster)}`
  return appendPath(SOLANA_EXPLORER_BASE, options, clusterParam)
}
