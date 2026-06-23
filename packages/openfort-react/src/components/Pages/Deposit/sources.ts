/**
 * Funding destination defaults + small formatting helpers. The source chain/token
 * registry is no longer hardcoded here — it's fetched live from Relay via
 * `useFundingChains`.
 */

/** Destination default: USDC on Base (used when the integrator doesn't override). */
export const DEST_CHAIN = 'eip155:8453'
export const DEST_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/**
 * Solana destination default: USDC on Solana mainnet, used for SVM wallets when the
 * integrator doesn't override. The chain id must match the Solana entry in
 * {@link DEFAULT_SOURCE_CHAINS} so a same-chain selection resolves to the wallet address.
 */
export const DEST_CHAIN_SOL = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const DEST_USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/** EVM native-asset sentinel (zero address) — the default destination currency on
 * chains where we don't ship a stablecoin address (e.g. testnets). */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

/** True for a CAIP-2 Solana chain id. */
export function isSolana(chain: string): boolean {
  return chain.startsWith('solana:')
}
