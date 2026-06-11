import type { Chain } from 'viem/chains'
import { baseSepolia, polygonAmoy } from 'viem/chains'

interface PlaygroundEvmChain {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  viemChain: Chain
}

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
