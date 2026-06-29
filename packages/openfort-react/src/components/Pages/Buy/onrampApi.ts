import { ChainTypeEnum } from '@openfort/openfort-js'

/** EVM chain id → onramp network name. */
const EVM_NETWORK_MAP: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
}

/**
 * Resolve the onramp destination network for the active chain. Solana always
 * resolves to `solana`; an EVM wallet whose `chainId` hasn't loaded yet returns
 * `undefined`, so callers stay gated until the chain is ready.
 */
export function resolveOnrampNetwork(chainType: ChainTypeEnum, chainId?: number): string | undefined {
  if (chainType === ChainTypeEnum.SVM) return 'solana'
  if (chainId == null) return undefined
  return EVM_NETWORK_MAP[chainId] ?? 'base'
}
