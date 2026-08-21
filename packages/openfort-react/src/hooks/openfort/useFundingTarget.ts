'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { DEST_CHAIN, DEST_CHAIN_SOL, DEST_USDC, DEST_USDC_SOL, NATIVE_TOKEN_ADDRESS } from './fundingSources.js'

/**
 * The destination route Deposit-hub funding settles into. Integrators override the
 * chain and currency via `uiConfig.funding.{targetChain,targetCurrency}`. With no
 * override the destination follows the wallet's ACTIVE chain — so a testnet wallet
 * funds on its own network instead of being told "funding isn't available on Base".
 * Currency defaults to USDC where we ship its address (Base, Solana mainnet) and to
 * the native asset otherwise, so the destination currency is always valid on-chain.
 * The deposit recipient is always the active embedded wallet — callers resolve it.
 */
export function useFundingTarget(): { chain: string; currency: string } {
  const { uiConfig } = useOpenfort()
  const chainType = useOpenfortCore((s) => s.chainType)
  const ethereumWallet = useEthereumEmbeddedWallet()
  const isSolana = chainType === ChainTypeEnum.SVM

  const activeChain = isSolana
    ? DEST_CHAIN_SOL
    : ethereumWallet.status === 'connected'
      ? `eip155:${ethereumWallet.chainId}`
      : DEST_CHAIN
  const chain = uiConfig.funding?.targetChain ?? activeChain

  const defaultCurrency =
    chain === DEST_CHAIN ? DEST_USDC : chain === DEST_CHAIN_SOL ? DEST_USDC_SOL : NATIVE_TOKEN_ADDRESS

  return {
    chain,
    currency: uiConfig.funding?.targetCurrency ?? defaultCurrency,
  }
}
