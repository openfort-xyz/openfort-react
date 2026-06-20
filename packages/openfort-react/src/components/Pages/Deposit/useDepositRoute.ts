'use client'

import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { type PaymentMethodInput, useFunding } from '../../../hooks/openfort/useFunding'
import {
  type FundingChain,
  type FundingCurrency,
  nominalUnits,
  useFundingChains,
} from '../../../hooks/openfort/useFundingChains'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import { logger } from '../../../utils/logger'
import { isCexDeliverable } from './cexChains'
import { isSolana } from './sources'
import { useFundingTarget } from './useFundingTarget'

/** Which rail the route feeds: self-custody wallet send vs exchange withdrawal. */
type DepositRouteKind = 'crypto' | 'cex'

function paymentMethodFor(chain: string, currency: FundingCurrency): PaymentMethodInput {
  const source = { chain, currency: currency.address, amount: nominalUnits(currency.decimals, currency.native) }
  // A CEX withdrawal is just an on-chain send to the Relay deposit address — the
  // funding API has no separate 'cex' type, so every source resolves to evm/solana.
  return { type: isSolana(chain) ? 'solana' : 'evm', source }
}

/**
 * Shared state for a deposit route: the source chain/currency selection (sourced
 * live from Relay via {@link useFundingChains}) plus the resolved deposit
 * address. Both the "from wallet"/"from exchange" tabs and the standalone "from
 * address" page build on this — they differ only in the lead buttons.
 */
export function useDepositRoute(kind: DepositRouteKind) {
  const ethWallet = useEthereumEmbeddedWallet()
  const solWallet = useSolanaEmbeddedWallet()
  const { session, status, error, loading, isAvailable, fund, payLink, reset } = useFunding()
  const { chains: allChains, loading: chainsLoading } = useFundingChains()
  const target = useFundingTarget()
  // The deposit recipient must live on the TARGET chain, so resolve the wallet by
  // the target's family — not the active chainType, which can disagree with the
  // target (e.g. an EVM session whose funding target is still Solana) and would
  // send an EVM address as the recipient for a Solana destination.
  const wallet = isSolana(target.chain) ? solWallet : ethWallet
  // Sources are the full Relay list, including the destination chain itself so
  // same-chain deposits (e.g. Solana → Solana) are offered as a plain transfer to
  // the wallet address, alongside the cross-chain bridge routes. The CEX rail rides
  // Coinbase Onramp, which only delivers to a fixed set of EVM chains.
  const chains: FundingChain[] = kind === 'cex' ? allChains.filter((c) => isCexDeliverable(c.id)) : allChains
  // Where funds land: the active embedded wallet (the Relay deposit recipient).
  const address = wallet.status === 'connected' ? wallet.address : undefined

  const [chainId, setChainId] = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('')
  const lastKey = useRef('')

  // Derive the active selection, falling back to the first available chain/currency
  // so the picker is valid before the user touches it and as chains load in.
  const activeChain = chains.find((c) => c.id === chainId) ?? chains[0]
  const currencies = activeChain?.currencies ?? []
  const activeCurrency = currencies.find((c) => c.symbol === currencySymbol) ?? currencies[0]
  const chain = activeChain?.id ?? target.chain
  const sameChain = chain === target.chain
  const receiverAddress: string | null = sameChain
    ? (address ?? null)
    : (session?.paymentMethod?.receiverAddress ?? null)
  const pm = session?.paymentMethod ?? null

  useEffect(() => {
    if (!address || !isAvailable || !activeChain || !activeCurrency) return
    if (sameChain) {
      lastKey.current = ''
      reset()
      return
    }
    const key = `${kind}:${activeChain.id}:${activeCurrency.symbol}`
    if (lastKey.current === key) return
    lastKey.current = key
    logger.log('[funding:route] resolved', {
      kind,
      sourceChain: activeChain.id,
      currency: activeCurrency.symbol,
      destChain: target.chain,
    })
    fund(
      { chain: target.chain, currency: target.currency, address },
      paymentMethodFor(activeChain.id, activeCurrency)
    ).catch(() => {})
  }, [address, activeChain, activeCurrency, isAvailable, sameChain, fund, reset, target.chain, target.currency, kind])

  // Surface an empty source list (e.g. no Coinbase-deliverable chains) for diagnosis.
  useEffect(() => {
    if (!isAvailable || chainsLoading || chains.length > 0) return
    logger.warn('[funding:route] no source chains available', { kind, destChain: target.chain })
  }, [isAvailable, chainsLoading, chains.length, kind, target.chain])

  return {
    chains,
    chainsLoading,
    chain,
    setChain: setChainId,
    currency: activeCurrency?.symbol ?? '',
    setCurrency: setCurrencySymbol,
    currencies,
    activeChain,
    activeCurrency,
    address,
    target,
    pm,
    receiverAddress,
    sameChain,
    status,
    loading,
    error,
    isAvailable,
    payLink,
  }
}
