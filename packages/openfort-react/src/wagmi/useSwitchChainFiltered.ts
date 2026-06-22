'use client'

import { useMemo } from 'react'
import { useSwitchChain } from 'wagmi'
import { useOpenfort } from '../components/Openfort/useOpenfort'
import { getPublishableKeyEnvironment } from '../utils/validation'

/**
 * Wraps wagmi's `useSwitchChain`, restricting the switchable chains to those
 * matching the Openfort publishable key environment.
 *
 * - `pk_test_…` keys expose only testnet chains (`chain.testnet === true`)
 * - `pk_live_…` keys expose only mainnet chains (`chain.testnet !== true`)
 *
 * When the key prefix is unknown, or filtering would leave no chains (e.g. a
 * misconfigured wagmi `chains` list), the developer's full chain list is
 * returned unchanged to avoid an empty selector.
 */
export const useSwitchChainFiltered = () => {
  const result = useSwitchChain()
  const { publishableKey } = useOpenfort()

  const chains = useMemo(() => {
    const env = getPublishableKeyEnvironment(publishableKey)
    if (!env) return result.chains
    const filtered = result.chains.filter((c) => (env === 'live' ? c.testnet !== true : c.testnet === true))
    return filtered.length > 0 ? filtered : result.chains
  }, [result.chains, publishableKey])

  return { ...result, chains }
}
