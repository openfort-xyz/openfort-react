'use client'

import type { Chain } from 'viem'
import { useConfig } from 'wagmi'

/**
 * Access all blockchain chains configured in the Wagmi config.
 *
 * Use this hook from `@openfort/react/wagmi` when your app uses WagmiProvider.
 * Returns an array of chain objects (id, name, nativeCurrency, etc.).
 *
 * @returns Array of configured blockchain chains
 *
 * @example
 * ```tsx
 * import { useChains } from '@openfort/react/wagmi'
 *
 * function ChainSelector() {
 *   const chains = useChains()
 *
 *   return (
 *     <select>
 *       {chains.map((chain) => (
 *         <option key={chain.id} value={chain.id}>
 *           {chain.name}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export function useChains(): Chain[] {
  const wagmi = useConfig()
  const chains = wagmi?.chains ?? []
  return chains.map((c) => c) as Chain[]
}
