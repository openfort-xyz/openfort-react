'use client'

import { useEffect, useMemo } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { useOpenfort } from '../components/Openfort/useOpenfort.js'
import { logger } from '../utils/logger.js'
import { getPublishableKeyEnvironment } from '../utils/validation.js'

/**
 * Wraps wagmi's `useSwitchChain`, restricting the switchable chains to those
 * matching the Openfort publishable key environment.
 *
 * - `pk_test_…` keys expose only testnet chains (`chain.testnet === true`)
 * - `pk_live_…` keys expose only mainnet chains (`chain.testnet !== true`)
 *
 * The chain the wallet is currently connected to is always kept in the list,
 * even when it doesn't match the environment, so the selector can still display
 * it and let the user switch away (without it, the active-chain lookups in the
 * UI would resolve to `undefined` and the switch control would disappear).
 *
 * Chains rely on viem's `testnet` flag; custom chains defined without it are
 * treated as mainnet. When the key prefix is unknown, or no configured chain
 * matches the environment, the developer's full chain list is returned
 * unchanged to avoid an empty selector.
 */
export const useSwitchChainFiltered = () => {
  const result = useSwitchChain()
  const { publishableKey } = useOpenfort()
  const activeChainId = useChainId()

  const env = getPublishableKeyEnvironment(publishableKey)
  const allChains = result.chains
  const noChainMatchesEnv = env != null && !allChains.some((c) => matchesEnvironment(c, env))

  // Warn (dev only — gated behind debug mode) when the publishable key
  // environment doesn't match any configured chain, since the env filter then
  // falls back to the full list and silently does nothing.
  useEffect(() => {
    if (noChainMatchesEnv) {
      logger.warn(
        `No configured chain matches the "${env}" publishable key environment; ` +
          'showing all chains. Check your wagmi chains and publishable key.'
      )
    }
  }, [noChainMatchesEnv, env])

  const chains = useMemo(() => {
    if (!env) return allChains
    const filtered = allChains.filter((c) => c.id === activeChainId || matchesEnvironment(c, env))
    return filtered.length > 0 ? filtered : allChains
  }, [allChains, env, activeChainId])

  return { ...result, chains }
}

function matchesEnvironment(chain: { testnet?: boolean }, env: 'test' | 'live'): boolean {
  return env === 'live' ? chain.testnet !== true : chain.testnet === true
}
