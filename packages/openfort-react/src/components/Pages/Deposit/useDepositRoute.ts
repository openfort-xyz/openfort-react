'use client'

import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { type PaymentMethodInput, useFunding } from '../../../hooks/openfort/useFunding'
import { addressFor, isSolana, NOMINAL_UNITS, SOURCE_CHAINS, tokensFor } from './sources'
import { useFundingTarget } from './useFundingTarget'

/** Which rail the route feeds: self-custody wallet send vs exchange withdrawal. */
export type DepositRouteKind = 'crypto' | 'cex'

// Exchanges withdraw to EVM networks; Solana CEX withdrawal isn't profiled yet.
const CEX_CHAINS = SOURCE_CHAINS.filter((c) => !isSolana(c.id))

function paymentMethodFor(kind: DepositRouteKind, chain: string, currency: string): PaymentMethodInput {
  const source = { chain, currency, amount: NOMINAL_UNITS }
  if (kind === 'cex') return { type: 'cex', cex: 'binance', source }
  return { type: isSolana(chain) ? 'solana' : 'evm', source }
}

/**
 * Shared state for a deposit route: the source chain/token selection plus the
 * resolved deposit address. Both the "from wallet" and "from exchange" tabs and
 * the standalone "from address" page build on this — they differ only in the
 * lead buttons rendered above the address block.
 */
export function useDepositRoute(kind: DepositRouteKind) {
  const wallet = useEthereumEmbeddedWallet()
  const { session, error, loading, isAvailable, fund, payLink, reset } = useFunding()
  const target = useFundingTarget()
  const chains = kind === 'cex' ? CEX_CHAINS : SOURCE_CHAINS
  // Where funds land: the integrator's override, else the active embedded wallet.
  const walletAddress = wallet.status === 'connected' ? wallet.address : undefined
  const address = target.address ?? walletAddress
  const firstChain = chains[0]?.id ?? target.chain
  const [chain, setChain] = useState(firstChain)
  const [token, setToken] = useState(tokensFor(firstChain)[0]?.symbol ?? 'USDC')
  const pm = session?.paymentMethod ?? null
  const lastKey = useRef('')

  const tokens = tokensFor(chain)
  const activeToken = tokens.some((t) => t.symbol === token) ? token : (tokens[0]?.symbol ?? 'USDC')
  const sameChain = chain === target.chain
  const receiverAddress: string | null = sameChain ? (address ?? null) : (pm?.receiverAddress ?? null)

  useEffect(() => {
    if (!address || !isAvailable) return
    if (sameChain) {
      lastKey.current = ''
      reset()
      return
    }
    const key = `${kind}:${chain}:${activeToken}`
    if (lastKey.current === key) return
    lastKey.current = key
    fund(
      { chain: target.chain, currency: target.currency, address },
      paymentMethodFor(kind, chain, addressFor(chain, activeToken))
    ).catch(() => {})
  }, [address, chain, activeToken, isAvailable, sameChain, fund, reset, target.chain, target.currency, kind])

  return {
    chains,
    chain,
    setChain,
    token: activeToken,
    setToken,
    tokens,
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
