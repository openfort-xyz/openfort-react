/**
 * RPC Utilities
 *
 * Default RPC URLs and chain metadata — sourced from viem/chains where possible.
 * Production apps must provide their own RPCs via walletConfig.ethereum.rpcUrls.
 */

import type { Chain } from 'viem'
import { defineChain } from 'viem'
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  beam,
  beamTestnet,
  bsc,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains'
import { RpcUrlNotConfiguredError } from '../errors/config.js'
import type { SolanaCluster } from '../solana/types.js'
import { logger } from './logger.js'

/** Known chains sourced from viem/chains — authoritative metadata (name, nativeCurrency, rpcUrls, blockExplorers). */
const KNOWN_CHAINS: Record<number, Chain> = {
  // Testnets
  [polygonAmoy.id]: polygonAmoy,
  [baseSepolia.id]: baseSepolia,
  [beamTestnet.id]: beamTestnet,
  [sepolia.id]: sepolia,
  [optimismSepolia.id]: optimismSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  // Mainnets — the public default RPCs make apps work out of the box, but they
  // are rate-limited; production apps should set walletConfig.ethereum.rpcUrls
  // (a warning nudges them, see warnPublicRpcIfMainnet).
  [mainnet.id]: mainnet,
  [base.id]: base,
  [polygon.id]: polygon,
  [optimism.id]: optimism,
  [arbitrum.id]: arbitrum,
  [bsc.id]: bsc,
  [beam.id]: beam,
}

const warnedPublicRpcChainIds = new Set<number>()

/** Warn once per mainnet chain when the app is running on a public default RPC. */
function warnPublicRpcIfMainnet(chain: Chain): void {
  if (chain.testnet === true || warnedPublicRpcChainIds.has(chain.id)) return
  warnedPublicRpcChainIds.add(chain.id)
  logger.warn(
    `Using the public default RPC for ${chain.name} (${chain.id}). Public endpoints are rate-limited — provide walletConfig.ethereum.rpcUrls[${chain.id}] in production.`
  )
}

/** Testnets not in {@link KNOWN_CHAINS} but still worth recognizing (deprecated/uncommon). */
const EXTRA_TESTNET_CHAIN_IDS = new Set<number>([5, 80001, 97, 4002])

/**
 * Whether an EVM chain id is a testnet. Reads viem's chain metadata (`testnet`)
 * for the chains the SDK bundles, falling back to a small extra set. Use this to
 * key behaviour off the wallet's active chain rather than the publishable key.
 */
export function isTestnetChainId(chainId: number): boolean {
  return KNOWN_CHAINS[chainId]?.testnet === true || EXTRA_TESTNET_CHAIN_IDS.has(chainId)
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
    warnPublicRpcIfMainnet(knownChain)
    return knownChain
  }

  const rpcUrl = customRpcUrl ?? knownChain?.rpcUrls.default.http[0]
  if (!rpcUrl) {
    throw new RpcUrlNotConfiguredError({ chainId })
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
