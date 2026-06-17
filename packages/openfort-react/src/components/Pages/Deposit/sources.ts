/**
 * Funding destination defaults + small formatting helpers. The source chain/token
 * registry is no longer hardcoded here — it's fetched live from Relay via
 * `useFundingChains`.
 */

/** Destination default: USDC on Base (used when the integrator doesn't override). */
export const DEST_CHAIN = 'eip155:8453'
export const DEST_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/** True for a CAIP-2 Solana chain id. */
export function isSolana(chain: string): boolean {
  return chain.startsWith('solana:')
}
