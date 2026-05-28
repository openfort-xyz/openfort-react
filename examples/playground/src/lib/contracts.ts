import { PLAYGROUND_EVM_CHAINS } from '@/lib/chains'

/** Chain IDs supported for mint contracts */
const SUPPORTED_CHAIN_IDS = new Set(PLAYGROUND_EVM_CHAINS.map((c) => c.id))

/** Fallback addresses when env vars are not set */
const DEFAULT_POLYGON_MINT = '0xbabe0001489722187FbaF0689C47B2f5E97545C5'

type MintContractType = 'claim' | 'mint'

export interface MintContractConfig {
  address: string
  type: MintContractType
}

export const BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/**
 * Returns the mint contract address for the given chainId.
 * Polygon Amoy / Base Sepolia: VITE_POLYGON_MINT_CONTRACT (mint interface)
 */
export function getMintContractAddress(chainId: number | undefined): string | undefined {
  if (chainId == null) return undefined
  if (SUPPORTED_CHAIN_IDS.has(chainId)) {
    return import.meta.env.VITE_POLYGON_MINT_CONTRACT || DEFAULT_POLYGON_MINT
  }
  return undefined
}

/**
 * Returns a full MintContractConfig for the given chainId.
 * Use this when you need to know whether to call claim() or mint().
 */
export function getMintContractConfig(chainId: number | undefined): MintContractConfig | undefined {
  const address = getMintContractAddress(chainId)
  if (!address) return undefined
  return { address, type: 'mint' }
}
