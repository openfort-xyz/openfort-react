'use client'

import { useOpenfort } from '../../Openfort/useOpenfort'
import { DEST_CHAIN, DEST_USDC } from './sources'

/**
 * The destination route Deposit-hub funding settles into. Integrators override
 * it via `uiConfig.funding.{targetChain,targetCurrency}`; defaults to USDC on
 * Base so the flow works with zero configuration.
 */
export function useFundingTarget(): { chain: string; currency: string } {
  const { uiConfig } = useOpenfort()
  return {
    chain: uiConfig.funding?.targetChain ?? DEST_CHAIN,
    currency: uiConfig.funding?.targetCurrency ?? DEST_USDC,
  }
}
