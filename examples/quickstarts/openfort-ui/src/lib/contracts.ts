/** Chain IDs for mint contracts (viem/wagmi) */
const BEAM_CHAIN_ID = 13337
const POLYGON_CHAIN_ID = 80002
const BASE_SEPOLIA_CHAIN_ID = 84532

/** Fallback addresses when env vars are not set */
const DEFAULT_POLYGON_MINT = '0xef147ed8bb07a2a0e7df4c1ac09e96dec459ffac'
const DEFAULT_BEAM_MINT = '0x45238AB60ACA6862a70fe996D1A8baDb71Af5A8f'

type MintContractType = 'claim' | 'mint'

interface MintContractConfig {
  address: string
  type: MintContractType
}

function getMintContractAddress(chainId: number | undefined): string | undefined {
  if (chainId == null) return undefined
  if (chainId === BEAM_CHAIN_ID) {
    return import.meta.env.VITE_BEAM_MINT_CONTRACT ?? DEFAULT_BEAM_MINT
  }
  if (chainId === POLYGON_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID) {
    return import.meta.env.VITE_POLYGON_MINT_CONTRACT ?? DEFAULT_POLYGON_MINT
  }
  return import.meta.env.VITE_POLYGON_MINT_CONTRACT ?? DEFAULT_POLYGON_MINT
}

export function getMintContractConfig(chainId: number | undefined): MintContractConfig | undefined {
  const address = getMintContractAddress(chainId)
  if (!address) return undefined
  return {
    address,
    type: chainId === BEAM_CHAIN_ID ? 'claim' : 'mint',
  }
}
