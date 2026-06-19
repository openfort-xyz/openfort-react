'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { DEST_CHAIN, DEST_CHAIN_SOL, DEST_USDC, DEST_USDC_SOL } from './sources'

/**
 * The destination route Deposit-hub funding settles into. Integrators override
 * it via `uiConfig.funding.{targetChain,targetCurrency,targetAddress}`; chain and
 * currency default to USDC on the active chain type (Base for EVM, Solana mainnet
 * for SVM) so the flow works with zero configuration. `address` is undefined unless
 * overridden — callers fall back to the active embedded wallet.
 */
export function useFundingTarget(): { chain: string; currency: string; address?: string } {
  const { uiConfig } = useOpenfort()
  const { chainType } = useOpenfortCore()
  const isSolana = chainType === ChainTypeEnum.SVM
  return {
    chain: uiConfig.funding?.targetChain ?? (isSolana ? DEST_CHAIN_SOL : DEST_CHAIN),
    currency: uiConfig.funding?.targetCurrency ?? (isSolana ? DEST_USDC_SOL : DEST_USDC),
    address: uiConfig.funding?.targetAddress,
  }
}
