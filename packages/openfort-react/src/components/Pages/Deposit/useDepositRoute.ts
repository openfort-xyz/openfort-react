'use client'

import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { type PaymentMethodInput, useFunding } from '../../../hooks/openfort/useFunding'
import {
  type FundingChain,
  type FundingToken,
  nominalUnits,
  useFundingChains,
} from '../../../hooks/openfort/useFundingChains'
import { isSolana } from './sources'
import { useFundingTarget } from './useFundingTarget'

/** Which rail the route feeds: self-custody wallet send vs exchange withdrawal. */
export type DepositRouteKind = 'crypto' | 'cex'

function paymentMethodFor(kind: DepositRouteKind, chain: string, token: FundingToken): PaymentMethodInput {
  const source = { chain, currency: token.address, amount: nominalUnits(token.decimals) }
  if (kind === 'cex') return { type: 'cex', cex: 'binance', source }
  return { type: isSolana(chain) ? 'solana' : 'evm', source }
}

/**
 * Shared state for a deposit route: the source chain/token selection (sourced
 * live from Relay via {@link useFundingChains}) plus the resolved deposit
 * address. Both the "from wallet"/"from exchange" tabs and the standalone "from
 * address" page build on this — they differ only in the lead buttons.
 */
export function useDepositRoute(kind: DepositRouteKind) {
  const wallet = useEthereumEmbeddedWallet()
  const { session, error, loading, isAvailable, fund, payLink, reset } = useFunding()
  const { chains: allChains, loading: chainsLoading } = useFundingChains()
  const target = useFundingTarget()
  // Exchanges withdraw to EVM networks; Solana CEX withdrawal isn't profiled yet.
  const chains: FundingChain[] = kind === 'cex' ? allChains.filter((c) => c.vmType === 'evm') : allChains
  // Where funds land: the integrator's override, else the active embedded wallet.
  const walletAddress = wallet.status === 'connected' ? wallet.address : undefined
  const address = target.address ?? walletAddress

  const [chainId, setChainId] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const lastKey = useRef('')

  // Derive the active selection, falling back to the first available chain/token
  // so the picker is valid before the user touches it and as chains load in.
  const activeChain = chains.find((c) => c.id === chainId) ?? chains[0]
  const tokens = activeChain?.tokens ?? []
  const activeToken = tokens.find((t) => t.symbol === tokenSymbol) ?? tokens[0]
  const chain = activeChain?.id ?? target.chain
  const sameChain = chain === target.chain
  const receiverAddress: string | null = sameChain
    ? (address ?? null)
    : (session?.paymentMethod?.receiverAddress ?? null)
  const pm = session?.paymentMethod ?? null

  useEffect(() => {
    if (!address || !isAvailable || !activeChain || !activeToken) return
    if (sameChain) {
      lastKey.current = ''
      reset()
      return
    }
    const key = `${kind}:${activeChain.id}:${activeToken.symbol}`
    if (lastKey.current === key) return
    lastKey.current = key
    fund(
      { chain: target.chain, currency: target.currency, address },
      paymentMethodFor(kind, activeChain.id, activeToken)
    ).catch(() => {})
  }, [address, activeChain, activeToken, isAvailable, sameChain, fund, reset, target.chain, target.currency, kind])

  return {
    chains,
    chainsLoading,
    chain,
    setChain: setChainId,
    token: activeToken?.symbol ?? '',
    setToken: setTokenSymbol,
    tokens,
    activeChain,
    activeToken,
    address,
    target,
    pm,
    receiverAddress,
    sameChain,
    loading,
    error,
    isAvailable,
    payLink,
  }
}
