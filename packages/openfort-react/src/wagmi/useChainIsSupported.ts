'use client'

import { useConfig } from 'wagmi'

/**
 * Check if a chain ID is supported in the current Wagmi configuration.
 *
 * Use this hook from `@openfort/react/wagmi` when your app uses WagmiProvider.
 *
 * @param chainId - The blockchain chain ID to check.
 * @returns `true` when the chain is configured, `false` otherwise.
 *
 * @example
 * ```tsx
 * import { useChainIsSupported } from '@openfort/react/wagmi'
 *
 * function ChainStatus({ chainId }: { chainId?: number }) {
 *   const isSupported = useChainIsSupported(chainId)
 *
 *   return <span>{isSupported ? 'Supported' : 'Unsupported'}</span>
 * }
 * ```
 */
export function useChainIsSupported(chainId?: number): boolean {
  const { chains } = useConfig()
  if (chainId === undefined || chainId === null) return false
  return chains.some((x) => x.id === chainId)
}
