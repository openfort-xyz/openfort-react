'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { DEST_CHAIN, DEST_CHAIN_SOL, DEST_USDC, DEST_USDC_SOL } from './sources'

/**
 * The destination route Deposit-hub funding settles into. Integrators override the
 * chain and currency via `uiConfig.funding.{targetChain,targetCurrency}`; both
 * default to USDC on the active chain type (Base for EVM, Solana mainnet for SVM)
 * so the flow works with zero configuration. `address` is the optional integrator
 * override (`uiConfig.funding.targetAddress`); when unset, callers fall back to the
 * active embedded wallet for the destination chain family.
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
