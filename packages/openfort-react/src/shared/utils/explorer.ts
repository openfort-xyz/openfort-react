import { ChainTypeEnum } from '@openfort/openfort-js'
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  beamTestnet,
  bsc,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains'
import type { SolanaCluster } from '../../solana/types.js'
import { logger } from '../../utils/logger.js'

/** Options for building a block explorer URL. */
type ExplorerUrlOptions = {
  address?: string
  txHash?: string
  chainId?: number
  cluster?: SolanaCluster
}

const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com'

/** Known EVM chains with block explorers — sourced from viem/chains. */
const EVM_CHAINS_BY_ID = {
  [mainnet.id]: mainnet,
  [optimism.id]: optimism,
  [polygon.id]: polygon,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [bsc.id]: bsc,
  [polygonAmoy.id]: polygonAmoy,
  [baseSepolia.id]: baseSepolia,
  [beamTestnet.id]: beamTestnet,
  [sepolia.id]: sepolia,
  [optimismSepolia.id]: optimismSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
}

function appendPath(base: string, options: { address?: string; txHash?: string }, queryParams?: string): string {
  let path = base
  // Encoded so a value carrying '?', '#' or '../' cannot retarget the URL.
  if (options.address) path = `${base}/address/${encodeURIComponent(options.address)}`
  else if (options.txHash) path = `${base}/tx/${encodeURIComponent(options.txHash)}`
  return queryParams ? `${path}?${queryParams}` : path
}

type ExplorerUrlBuilder = (options: ExplorerUrlOptions) => string

/**
 * `getExplorerUrl` is called from render bodies, so an unsupported chain would
 * otherwise warn on every render. Each distinct reason is reported once.
 */
const warnedExplorerReasons = new Set<string>()
const warnOnceForExplorer = (reason: string, message: string) => {
  if (warnedExplorerReasons.has(reason)) return
  warnedExplorerReasons.add(reason)
  logger.warn(message)
}

const explorerRegistry: Record<ChainTypeEnum, ExplorerUrlBuilder> = {
  [ChainTypeEnum.EVM]: (options) => {
    // Never fall back to an unrelated chain's explorer — a valid hash on the wrong
    // explorer reads as "transaction not found". Return '' so callers hide the link.
    if (!options.chainId) {
      warnOnceForExplorer('evm:no-chain-id', 'No chain ID provided; cannot build an explorer URL for this transaction.')
      return ''
    }
    const chain = EVM_CHAINS_BY_ID[options.chainId as keyof typeof EVM_CHAINS_BY_ID]
    const explorerUrl = chain?.blockExplorers?.default.url
    if (!explorerUrl) {
      warnOnceForExplorer(
        `evm:${options.chainId}`,
        `No explorer URL known for chain ${options.chainId}; the explorer link is unavailable.`
      )
      return ''
    }
    return appendPath(explorerUrl, options)
  },
  [ChainTypeEnum.SVM]: (options) => {
    if (!options.cluster) {
      warnOnceForExplorer('solana-cluster-missing', 'No cluster provided; defaulting to the Solana mainnet explorer.')
      return appendPath(SOLANA_EXPLORER_BASE, options)
    }
    const clusterParam =
      options.cluster === 'mainnet-beta' ? undefined : `cluster=${encodeURIComponent(options.cluster)}`
    return appendPath(SOLANA_EXPLORER_BASE, options, clusterParam)
  },
}

/**
 * Builds a block explorer URL for an address or transaction on the given chain.
 *
 * @param chainType - EVM or SVM
 * @param options - address, txHash, chainId (EVM), or cluster (Solana)
 * @returns Full explorer URL
 *
 * @example
 * ```tsx
 * const url = getExplorerUrl(ChainTypeEnum.EVM, { address: '0x...', chainId: 1 })
 * const txUrl = getExplorerUrl(ChainTypeEnum.EVM, { txHash: '0x...', chainId: 1 })
 * ```
 */
export function getExplorerUrl(chainType: ChainTypeEnum, options: ExplorerUrlOptions): string {
  return explorerRegistry[chainType](options)
}
