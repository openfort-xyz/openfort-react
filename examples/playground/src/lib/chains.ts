import type { Chain } from 'viem/chains'
import { base, baseSepolia, polygonAmoy } from 'viem/chains'

interface PlaygroundEvmChain {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  viemChain: Chain
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
    id: baseSepolia.id,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    viemChain: baseSepolia,
  },
  {
    id: base.id,
    name: 'Base',
    rpcUrl: 'https://base-rpc.publicnode.com',
    explorerUrl: 'https://basescan.org',
    viemChain: base,
  },
]

export const DEFAULT_EVM_CHAIN = PLAYGROUND_EVM_CHAINS.find((c) => c.id === baseSepolia.id)!

export const EVM_CHAIN_BY_ID: Record<number, PlaygroundEvmChain> = Object.fromEntries(
  PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c])
)

export const RPC_URLS: Record<number, string> = Object.fromEntries(PLAYGROUND_EVM_CHAINS.map((c) => [c.id, c.rpcUrl]))

export function getPlaygroundRpcUrl(chainId?: number): string {
  if (chainId != null && RPC_URLS[chainId]) return RPC_URLS[chainId]
  return DEFAULT_EVM_CHAIN.rpcUrl
}

export const SOLANA_CLUSTER = 'devnet' as const
export const SOLANA_DEFAULT_RPC = 'https://api.devnet.solana.com'

export const AUTH_CALLBACK_PATH = '/auth/useAuthCallback'
