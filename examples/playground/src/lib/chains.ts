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
const BASE_EVM_CHAINS: PlaygroundEvmChain[] = [
  {
    id: polygonAmoy.id,
    name: 'Polygon Amoy',
    // Third Amoy endpoint in this slot: polygon.technology went dark (empty
    // replies) and publicnode now answers 503 "no available nodes found for
    // platform polygon-amoy-bor". The SDK's provider init retries detectNetwork
    // forever against a dead endpoint, so the wallet never connects and every
    // EVM live test times out. drpc is not a candidate — its free tier refuses
    // `eth_blockNumber`.
    rpcUrl: 'https://polygon-amoy.gateway.tenderly.co',
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

export const PLAYGROUND_EVM_CHAINS: PlaygroundEvmChain[] = BASE_EVM_CHAINS

/**
 * Public RPC endpoints. The embedded signer's iframe and Openfort's backend
 * resolve these URLs from outside this machine, so they must always point at
 * reachable public nodes.
 */
export const WALLET_RPC_URLS: Record<number, string> = Object.fromEntries(BASE_EVM_CHAINS.map((c) => [c.id, c.rpcUrl]))

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

/** Native-asset sentinel: the zero address denotes a chain's native currency (ETH, …). */
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'

/**
 * Deposit-hub SOURCE config (the chains + currencies a user can fund FROM), matched
 * to the publishable key environment. The funding TARGET is deliberately NOT set
 * here — it's owned solely by {@link FundingTargetSync}, which follows the active
 * chain via {@link getFundingTargetForChain}. Test keys use Relay's testnet rail
 * (Base Sepolia / Sepolia; native ETH only, since testnets have no DEX liquidity to
 * swap into a stablecoin); live keys expose the major mainnet sources.
 */
export function getFundingConfigForKey(publishableKey?: string): {
  sourceChains: string[]
  sourceCurrencies: string[]
} {
  if (publishableKey?.startsWith('pk_test_')) {
    return {
      sourceChains: ['eip155:84532', 'eip155:11155111'], // Base Sepolia, Sepolia
      sourceCurrencies: ['native'], // ETH only — testnet swaps have no liquidity
    }
  }
  return {
    sourceChains: [
      'eip155:42161',
      'eip155:8453',
      'eip155:10',
      'eip155:137',
      'eip155:1',
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    ],
    sourceCurrencies: ['ETH', 'USDC', 'USDT', 'DAI'],
  }
}

export const DEFAULT_EVM_CHAIN = PLAYGROUND_EVM_CHAINS.find((c) => c.id === baseSepolia.id)!

export const EVM_CHAIN_BY_ID: Record<number, PlaygroundEvmChain> = Object.fromEntries(
  PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c])
)

const RPC_URLS: Record<number, string> = Object.fromEntries(PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c.rpcUrl]))

/**
 * Deposit-hub funding target (CAIP-2 chain + currency) for an active chain.
 *
 * Mainnet chains fund their USDC. Testnet chains fund their NATIVE asset (ETH):
 * Relay's testnet rail bridges same-asset but has no DEX liquidity to swap into a
 * stablecoin, so a USDC target would fail — native ETH is the route that works.
 * Returns undefined only for unknown chains (caller falls back).
 */
export function getFundingTargetForChain(
  chainId?: number
): { targetChain: string; targetCurrency: string } | undefined {
  const chain = chainId != null ? EVM_CHAIN_BY_ID[chainId] : undefined
  if (!chain) return undefined
  if (chain.viemChain.testnet) {
    return { targetChain: `eip155:${chain.id}`, targetCurrency: NATIVE_CURRENCY }
  }
  if (!chain.usdc) return undefined
  return { targetChain: `eip155:${chain.id}`, targetCurrency: chain.usdc }
}

/**
 * Fallback EVM funding target (Base USDC) for chains without a configured USDC
 * (testnets). Keeps the Deposit target on an EVM chain in EVM mode rather than
 * leaving a stale Solana target from a prior SVM session — a Solana target with
 * an EVM recipient makes Relay reject the route.
 */
export const DEFAULT_EVM_FUNDING_TARGET = getFundingTargetForChain(base.id)!

/**
 * Ethereum mainnet USDC as a simulated funding target. Not in the chain
 * switcher (no wallet ops on mainnet); exists because Stripe's EU delivery is
 * USDC·Ethereum only, so this is the one target that exercises the Stripe
 * embedded flow from an EU funding scenario.
 */
export const ETHEREUM_FUNDING_TARGET = {
  targetChain: 'eip155:1',
  targetCurrency: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}

/**
 * Testnet Deposit-hub target: Base Sepolia native ETH — the one EVM testnet Relay's
 * rail reliably delivers to. On a test key the target is pinned here regardless of
 * the active chain, so the deposit address always resolves (following the active
 * chain to e.g. Polygon Amoy leaves the deposit with no route — the "nothing inside"
 * case). Funds land at the same embedded-wallet address, visible once switched to
 * Base Sepolia.
 */
export const TESTNET_FUNDING_TARGET = {
  targetChain: `eip155:${baseSepolia.id}`,
  targetCurrency: NATIVE_CURRENCY,
} as const

/** True for a test publishable key (`pk_test_…`). */
export function isTestKey(publishableKey?: string): boolean {
  return publishableKey?.startsWith('pk_test_') ?? false
}

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
