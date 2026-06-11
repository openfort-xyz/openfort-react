'use client'

/**
 * Solana Context Provider
 *
 * Provides Solana configuration (cluster, RPC URL, commitment) to descendant components.
 * Cluster is fixed at config time and cannot be changed at runtime.
 */

import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { OpenfortError, OpenfortReactErrorType } from '../core/errors'
import type { SolanaCluster, SolanaCommitment, SolanaConfig } from './types'

/**
 * Solana context value with resolved configuration
 */
interface SolanaContextValue {
  /** Active Solana cluster */
  cluster: SolanaCluster
  /** RPC URL (resolved from config or default) */
  rpcUrl: string
  /** Transaction commitment level */
  commitment: SolanaCommitment
}

const DEFAULT_RPC_URLS: Partial<Record<SolanaCluster, string>> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

function getDefaultRpcUrl(cluster: SolanaCluster): string {
  const url = DEFAULT_RPC_URLS[cluster]
  if (!url) {
    throw new OpenfortError(
      `Unknown Solana cluster "${cluster}". Provide rpcUrls in walletConfig.solana.`,
      OpenfortReactErrorType.CONFIGURATION_ERROR
    )
  }
  return url
}

interface SolanaContextProviderProps {
  /** Solana configuration from OpenfortWalletConfig */
  config: SolanaConfig
  /** Child components */
  children: ReactNode
}

export const SolanaContext = createContext<SolanaContextValue | null>(null)

/**
 * Provides Solana configuration context to descendant components.
 *
 * This provider is automatically rendered by OpenfortProvider when
 * `walletConfig.solana` is configured.
 *
 * @example
 * ```tsx
 * // Usually you don't use this directly, configure via OpenfortProvider:
 * <OpenfortProvider
 *   publishableKey="pk_..."
 *   walletConfig={{
 *     shieldPublishableKey: 'shield_pk_...',
 *     solana: {
 *       cluster: 'mainnet-beta',
 *       commitment: 'confirmed'
 *     }
 *   }}
 * >
 *   <App />
 * </OpenfortProvider>
 * ```
 */
function resolveRpcUrl(cluster: SolanaCluster, config: SolanaConfig): string {
  const url = config.rpcUrls?.[cluster]
  if (url) return url
  return getDefaultRpcUrl(cluster)
}

const DEFAULT_CLUSTER: SolanaCluster = 'devnet'

export function SolanaContextProvider({ config, children }: SolanaContextProviderProps) {
  const cluster: SolanaCluster = config.cluster ?? DEFAULT_CLUSTER

  const rpcUrl = useMemo(() => resolveRpcUrl(cluster, config), [cluster, config])

  const value = useMemo<SolanaContextValue>(
    () => ({
      cluster,
      rpcUrl,
      commitment: config.commitment ?? 'confirmed',
    }),
    [cluster, rpcUrl, config.commitment]
  )

  return <SolanaContext.Provider value={value}>{children}</SolanaContext.Provider>
}

/**
 * Access the Solana context configuration.
 *
 * @throws Error if called outside of a SolanaContextProvider
 * (i.e., when `walletConfig.solana` is not configured in OpenfortProvider)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { cluster, rpcUrl, commitment } = useSolanaContext();
 *   // Use Solana configuration...
 * }
 * ```
 */
export function useSolanaContext(): SolanaContextValue {
  const context = useContext(SolanaContext)
  if (!context) {
    throw new Error(
      'useSolanaContext must be used within a SolanaContextProvider. ' +
        'Make sure walletConfig.solana is configured in OpenfortProvider.'
    )
  }
  return context
}
