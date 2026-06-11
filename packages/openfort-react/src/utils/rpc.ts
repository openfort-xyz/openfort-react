/**
 * RPC Utilities
 *
 * Default RPC URLs and chain metadata — sourced from viem/chains where possible.
 * Production apps must provide their own RPCs via walletConfig.ethereum.rpcUrls.
 */

import type { Chain } from 'viem'
import { defineChain } from 'viem'
import { arbitrumSepolia, baseSepolia, beamTestnet, optimismSepolia, polygonAmoy, sepolia } from 'viem/chains'
import type { SolanaCluster } from '../solana/types'
import { logger } from './logger'

/** Known chains sourced from viem/chains — authoritative metadata (name, nativeCurrency, rpcUrls, blockExplorers). */
const KNOWN_CHAINS: Record<number, Chain> = {
  [polygonAmoy.id]: polygonAmoy,
  [baseSepolia.id]: baseSepolia,
  [beamTestnet.id]: beamTestnet,
  [sepolia.id]: sepolia,
  [optimismSepolia.id]: optimismSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
}

/**
 * Default Solana RPC URLs by cluster.
 * Production apps should provide their own RPCs via walletConfig.solana.rpcUrls.
 */
const DEFAULT_SOLANA_RPC_URLS: Partial<Record<SolanaCluster, string>> = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
}

/**
 * Get default Ethereum RPC URL for a chain ID.
 * Returns the viem/chains default RPC when known, falls back to Sepolia.
 */
const warnedChainIds = new Set<number>()

export function getDefaultEthereumRpcUrl(chainId: number): string {
  const chain = KNOWN_CHAINS[chainId]
  const rpcUrl = chain?.rpcUrls.default.http[0]
  if (!rpcUrl) {
    if (!warnedChainIds.has(chainId)) {
      warnedChainIds.add(chainId)
      logger.warn(
        `No default Ethereum RPC URL found for chain ${chainId}. Configure rpcUrls in OpenfortProvider for better reliability and rate limits.`
      )
    }
    return sepolia.rpcUrls.default.http[0]
  }
  return rpcUrl
}

/**
 * Get default Solana RPC URL for a cluster.
 */
export function getDefaultSolanaRpcUrl(cluster: SolanaCluster): string {
  if (!DEFAULT_SOLANA_RPC_URLS[cluster]) {
    logger.warn(
      `No default Solana RPC URL found for cluster ${cluster}. Configure rpcUrls in OpenfortProvider for better reliability and rate limits.`
    )
    return 'https://api.devnet.solana.com'
  }
  return DEFAULT_SOLANA_RPC_URLS[cluster]
}

/**
 * Get chain name by chain ID.
 */
export function getChainName(chainId: number): string {
  return KNOWN_CHAINS[chainId]?.name ?? `Chain ${chainId}`
}

/**
 * Get native currency configuration for a chain.
 */
export function getNativeCurrency(chainId: number): { name: string; symbol: string; decimals: number } {
  return KNOWN_CHAINS[chainId]?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 }
}

/**
 * Build a viem Chain from chainId and optional rpcUrls (e.g. from walletConfig.ethereum.rpcUrls).
 * Returns the viem/chains object directly when the chain is known and no custom RPC is provided.
 */
export function buildChainFromConfig(chainId: number, rpcUrls?: Record<number, string>): Chain {
  const customRpcUrl = rpcUrls?.[chainId]
  const knownChain = KNOWN_CHAINS[chainId]

  if (knownChain && !customRpcUrl) {
    return knownChain
  }

  const rpcUrl = customRpcUrl ?? knownChain?.rpcUrls.default.http[0]
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ${chainId}. Provide walletConfig.ethereum.rpcUrls[${chainId}].`)
  }

  const native = knownChain?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 }
  const explorerUrl = knownChain?.blockExplorers?.default.url

  return defineChain({
    id: chainId,
    name: knownChain?.name ?? `Chain ${chainId}`,
    nativeCurrency: native,
    rpcUrls: { default: { http: [rpcUrl] } },
    ...(explorerUrl && { blockExplorers: { default: { name: 'Explorer', url: explorerUrl } } }),
  })
}
