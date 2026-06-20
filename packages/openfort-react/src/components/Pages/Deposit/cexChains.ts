/**
 * CAIP-2 chains the CEX rail (Coinbase Onramp "send") can deliver to, with their
 * display names. Single source of truth shared by the cex pay-link page
 * (DepositCex) and the exchange-withdraw source filter (useDepositRoute), so a
 * new deliverable chain is added in one place.
 */
export const CEX_CHAIN_NAMES: Record<string, string> = {
  'eip155:1': 'Ethereum',
  'eip155:10': 'Optimism',
  'eip155:137': 'Polygon',
  'eip155:8453': 'Base',
  'eip155:42161': 'Arbitrum',
  'eip155:43114': 'Avalanche',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
}

const CEX_CHAINS = new Set(Object.keys(CEX_CHAIN_NAMES))

/** Whether the CEX rail can deliver to the given CAIP-2 chain. */
export function isCexDeliverable(chain: string): boolean {
  return CEX_CHAINS.has(chain)
}
