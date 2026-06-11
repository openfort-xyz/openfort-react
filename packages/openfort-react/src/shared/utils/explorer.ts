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
import type { SolanaCluster } from '../../solana/types'
import { logger } from '../../utils/logger'

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
  if (options.address) path = `${base}/address/${options.address}`
  else if (options.txHash) path = `${base}/tx/${options.txHash}`
  return queryParams ? `${path}?${queryParams}` : path
}

type ExplorerUrlBuilder = (options: ExplorerUrlOptions) => string

const explorerRegistry: Record<ChainTypeEnum, ExplorerUrlBuilder> = {
  [ChainTypeEnum.EVM]: (options) => {
    if (!options.chainId) {
      logger.warn(
        'No chain ID provided. Configure explorerUrls in OpenfortProvider for better reliability and rate limits.'
      )
      return polygonAmoy.blockExplorers.default.url
    }
    const chain = EVM_CHAINS_BY_ID[options.chainId as keyof typeof EVM_CHAINS_BY_ID]
    const explorerUrl = chain?.blockExplorers?.default.url
    if (!explorerUrl) {
      logger.warn(
        `No explorer URL found for chain ${options.chainId}. Configure explorerUrls in OpenfortProvider for better reliability and rate limits.`
      )
      return polygonAmoy.blockExplorers.default.url
    }
    return appendPath(explorerUrl, options)
  },
  [ChainTypeEnum.SVM]: (options) => {
    if (!options.cluster) {
      logger.warn(
        'No cluster provided. Configure explorerUrls in OpenfortProvider for better reliability and rate limits.'
      )
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
