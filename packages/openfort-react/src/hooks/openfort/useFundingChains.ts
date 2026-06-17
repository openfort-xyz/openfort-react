'use client'

import { useEffect, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'

/** A source currency available on a chain (sourced live from Relay via the backend). */
export type FundingCurrency = {
  symbol: string
  /** Contract address, or the zero address for the chain's native asset. */
  address: string
  decimals: number
  logo: string | null
  /** True for the chain's native currency (ETH, SOL, POL, BNB, …). */
  native: boolean
}

/** A source chain the funding backend (Relay) can route from. */
export type FundingChain = {
  /** CAIP-2 chain id, e.g. "eip155:8453". */
  id: string
  name: string
  logo: string | null
  /** "evm" | "svm" — used to gate Solana sources and the CEX tab. */
  vmType: string
  currencies: FundingCurrency[]
}

export type UseFundingChains = {
  chains: FundingChain[]
  loading: boolean
  error: Error | null
}

/**
 * Sensible default source chains — the common funding origins. Override with
 * `uiConfig.funding.sourceChains`. Intersected with what the rail supports.
 */
export const DEFAULT_SOURCE_CHAINS = [
  'eip155:42161', // Arbitrum
  'eip155:8453', // Base
  'eip155:56', // BNB Chain
  'eip155:1', // Ethereum
  'eip155:143', // Monad
  'eip155:10', // Optimism
  'eip155:137', // Polygon
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana
]

/**
 * Default source currencies: the chain's `'native'` currency plus the major
 * stablecoins. Override with `uiConfig.funding.sourceCurrencies`.
 */
export const DEFAULT_SOURCE_CURRENCIES = ['native', 'USDC', 'USDT']

/**
 * The chains/currencies the funding backend supports, fetched from
 * `GET /v2/funding/chains` (a live passthrough of Relay's `/chains`), then
 * narrowed to a curated subset. The provider dictionary is dynamic; the client
 * just selects from it via `uiConfig.funding.{sourceChains,sourceCurrencies}`,
 * defaulting to {@link DEFAULT_SOURCE_CHAINS} / {@link DEFAULT_SOURCE_CURRENCIES}.
 *
 * Reads the base URL from `uiConfig.fundingBaseUrl`, mirroring `useFunding`.
 * Returns an empty list when funding isn't configured.
 */
export function useFundingChains(): UseFundingChains {
  const { uiConfig } = useOpenfort()
  const baseUrl = uiConfig.fundingBaseUrl ?? ''
  const sourceChains = uiConfig.funding?.sourceChains ?? DEFAULT_SOURCE_CHAINS
  const sourceCurrencies = uiConfig.funding?.sourceCurrencies ?? DEFAULT_SOURCE_CURRENCIES
  const [state, setState] = useState<UseFundingChains>({ chains: [], loading: Boolean(baseUrl), error: null })

  useEffect(() => {
    if (!baseUrl) {
      setState({ chains: [], loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    fetch(`${baseUrl}/v2/funding/chains`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load chains (${r.status})`)
        return r.json() as Promise<{ chains: FundingChain[] }>
      })
      .then((d) => {
        if (!cancelled) setState({ chains: d.chains ?? [], loading: false, error: null })
      })
      .catch((e) => {
        if (!cancelled) setState({ chains: [], loading: false, error: e instanceof Error ? e : new Error(String(e)) })
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  // Narrow the provider dictionary to the selected subset (cheap, O(chains)).
  return { ...state, chains: curateChains(state.chains, sourceChains, sourceCurrencies) }
}

/**
 * Narrow the fetched chains to a selection. `sourceChains` is a CAIP-2 allowlist
 * (also defines order); `sourceCurrencies` is a symbol allowlist where the
 * sentinel `'native'` matches each chain's native currency. Chains left with no
 * currency are dropped, and selected chains the rail doesn't support are skipped.
 */
export function curateChains(
  chains: FundingChain[],
  sourceChains: string[] | undefined,
  sourceCurrencies: string[] | undefined
): FundingChain[] {
  let out = chains
  if (sourceCurrencies && sourceCurrencies.length > 0) {
    const allow = new Set(sourceCurrencies.map((s) => s.toLowerCase()))
    const allowNative = allow.has('native')
    out = out
      .map((c) => ({
        ...c,
        currencies: c.currencies.filter((cur) => (allowNative && cur.native) || allow.has(cur.symbol.toLowerCase())),
      }))
      .filter((c) => c.currencies.length > 0)
  }
  if (sourceChains && sourceChains.length > 0) {
    const byId = new Map(out.map((c) => [c.id, c]))
    out = sourceChains.map((id) => byId.get(id)).filter((c): c is FundingChain => c !== undefined)
  }
  return out
}

/** Nominal source amount (in base units) used only to mint an open, route-bound deposit address.
 * 10 whole units = 10 · 10^decimals = "1" followed by (decimals + 1) zeros. */
export function nominalUnits(decimals: number): string {
  return `1${'0'.repeat(decimals + 1)}`
}
