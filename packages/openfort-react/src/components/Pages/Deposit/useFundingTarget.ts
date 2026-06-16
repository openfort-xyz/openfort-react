'use client'

import { useOpenfort } from '../../Openfort/useOpenfort'
import { DEST_CHAIN, DEST_USDC } from './sources'

/**
 * The destination route Deposit-hub funding settles into. Integrators override
 * it via `uiConfig.funding.{targetChain,targetCurrency,targetAddress}`; chain and
 * currency default to USDC on Base so the flow works with zero configuration.
 * `address` is undefined unless overridden — callers fall back to the active
 * embedded wallet.
 */
export function useFundingTarget(): { chain: string; currency: string; address?: string } {
  const { uiConfig } = useOpenfort()
  return {
    chain: uiConfig.funding?.targetChain ?? DEST_CHAIN,
    currency: uiConfig.funding?.targetCurrency ?? DEST_USDC,
    address: uiConfig.funding?.targetAddress,
  }
}
