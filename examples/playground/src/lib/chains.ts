import type { Chain } from 'viem/chains'
import { base, baseSepolia, polygon, polygonAmoy } from 'viem/chains'

interface PlaygroundEvmChain {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  viemChain: Chain
  /** Native USDC on this chain — used as the Deposit-hub funding target currency. */
  usdc?: string
}

// Order matters: the first entry is wagmi's default chain (useChainId when not
// connected), which is also the chain the embedded wallet is created on. Keep
// Polygon Amoy first so guest-wallet creation works under the CI test API key
// (a test key rejects mainnet chainIds) and the e2e can still switch *to* Base
// Sepolia. Base mainnet stays available for the funding deposit demo
// (funding.targetChain is independent of this order).
export const PLAYGROUND_EVM_CHAINS: PlaygroundEvmChain[] = [
  {
    id: polygonAmoy.id,
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    viemChain: polygonAmoy,
  },
  {
    id: base.id,
    name: 'Base',
    rpcUrl: 'https://base-rpc.publicnode.com',
    explorerUrl: 'https://basescan.org',
    viemChain: base,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    id: polygon.id,
    name: 'Polygon',
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    explorerUrl: 'https://polygonscan.com',
    viemChain: polygon,
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  {
    id: baseSepolia.id,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    viemChain: baseSepolia,
  },
]

/**
 * Restrict the EVM chains to those matching the publishable key environment:
 * `pk_test_…` keys expose only testnet chains, `pk_live_…` keys only mainnet
 * chains. Unknown key prefixes (or a filter that would empty the list) fall back
 * to the full list.
 */
export function getEvmChainsForKey(publishableKey?: string): PlaygroundEvmChain[] {
  const env = publishableKey?.startsWith('pk_live_') ? 'live' : publishableKey?.startsWith('pk_test_') ? 'test' : null
  if (!env) return PLAYGROUND_EVM_CHAINS
  const filtered = PLAYGROUND_EVM_CHAINS.filter((c) =>
    env === 'live' ? c.viemChain.testnet !== true : c.viemChain.testnet === true
  )
  return filtered.length > 0 ? filtered : PLAYGROUND_EVM_CHAINS
}

export const DEFAULT_EVM_CHAIN = PLAYGROUND_EVM_CHAINS.find((c) => c.id === baseSepolia.id)!

export const EVM_CHAIN_BY_ID: Record<number, PlaygroundEvmChain> = Object.fromEntries(
  PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c])
)

export const RPC_URLS: Record<number, string> = Object.fromEntries(PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c.rpcUrl]))

/**
 * Deposit-hub funding target (CAIP-2 chain + USDC address) for an active chain.
 * Returns undefined for chains without a configured USDC (e.g. testnets), so the
 * caller keeps the previous target instead of routing to an unsupported chain.
 */
export function getFundingTargetForChain(
  chainId?: number
): { targetChain: string; targetCurrency: string } | undefined {
  const chain = chainId != null ? EVM_CHAIN_BY_ID[chainId] : undefined
  if (!chain?.usdc) return undefined
  return { targetChain: `eip155:${chain.id}`, targetCurrency: chain.usdc }
}

/**
 * Fallback EVM funding target (Base USDC) for chains without a configured USDC
 * (testnets). Keeps the Deposit target on an EVM chain in EVM mode rather than
 * leaving a stale Solana target from a prior SVM session — a Solana target with
 * an EVM recipient makes Relay reject the route.
 */
export const DEFAULT_EVM_FUNDING_TARGET = getFundingTargetForChain(base.id)!

export function getPlaygroundRpcUrl(chainId?: number): string {
  if (chainId != null && RPC_URLS[chainId]) return RPC_URLS[chainId]
  return DEFAULT_EVM_CHAIN.rpcUrl
}

export const SOLANA_CLUSTER = 'devnet' as const
export const SOLANA_DEFAULT_RPC = 'https://api.devnet.solana.com'

/**
 * Deposit-hub funding target for Solana — mainnet USDC. The rail (Relay/Coinbase)
 * settles on mainnet regardless of the wallet's devnet cluster; the embedded
 * wallet address is the same across clusters, so deposits land in the same wallet.
 */
export const SOLANA_FUNDING_TARGET = {
  // Solana mainnet CAIP-2 id, matching the rail's chain list (useFundingChains).
  targetChain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  // Native USDC mint on Solana mainnet.
  targetCurrency: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
} as const

export const AUTH_CALLBACK_PATH = '/auth/useAuthCallback'
