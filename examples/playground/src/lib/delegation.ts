import { baseSepolia, polygonAmoy } from 'viem/chains'

/**
 * Cross-chain portability of EIP-7702 delegated (Calibur) embedded accounts.
 *
 * A delegated account is the same EOA address on every chain, but it can only
 * transact on a chain where its implementation contract is deployed + supported.
 * Calibur V8 ("Calibur") is NOT deployed on Polygon Amoy, so a V8 account created
 * on Base Sepolia cannot be used after switching to Amoy. Calibur V9 ("CaliburV9")
 * — the default for newly created accounts — is deployed on every supported chain
 * and is fully portable.
 *
 * Implementation types not listed here are assumed portable across all playground
 * chains (the safe default — never warn unless we know about a real limitation).
 */
const DELEGATED_IMPL_SUPPORTED_CHAINS: Record<string, number[]> = {
  Calibur: [baseSepolia.id], // V8 — Base Sepolia only (not deployed on Amoy)
  CaliburV9: [baseSepolia.id, polygonAmoy.id], // V9 — portable across all playground chains
}

/** True if a delegated account with this implementationType can transact on the chain. */
export function isDelegatedAccountUsableOnChain(
  implementationType: string | undefined,
  chainId: number | undefined
): boolean {
  if (!implementationType || chainId == null) return true
  const supported = DELEGATED_IMPL_SUPPORTED_CHAINS[implementationType]
  return supported ? supported.includes(chainId) : true
}

/** Human-friendly label for a delegated implementation type. */
export function delegatedImplLabel(implementationType: string | undefined): string {
  if (implementationType === 'Calibur') return 'Calibur V8'
  if (implementationType === 'CaliburV9') return 'Calibur V9'
  return implementationType ?? 'this wallet'
}
