'use client'

import { useEffect, useState } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'

/** A source token available on a chain (sourced live from Relay via the backend). */
export type FundingToken = {
  symbol: string
  /** Contract address, or the zero address for the chain's native asset. */
  address: string
  decimals: number
  logo: string | null
}

/** A source chain the funding backend (Relay) can route from. */
export type FundingChain = {
  /** CAIP-2 chain id, e.g. "eip155:8453". */
  id: string
  name: string
  logo: string | null
  /** "evm" | "svm" — used to gate Solana sources and the CEX tab. */
  vmType: string
  tokens: FundingToken[]
}

export type UseFundingChains = {
  chains: FundingChain[]
  loading: boolean
  error: Error | null
}

/**
 * The chains/tokens the funding backend supports, fetched from
 * `GET /v1/funding/chains` (a live passthrough of Relay's `/chains`). Nothing is
 * hardcoded — the deposit pickers track whatever Relay actually supports.
 *
 * Reads the base URL from `uiConfig.fundingBaseUrl`, mirroring `useFunding`.
 * Returns an empty list when funding isn't configured.
 */
export function useFundingChains(): UseFundingChains {
  const { uiConfig } = useOpenfort()
  const baseUrl = uiConfig.fundingBaseUrl ?? ''
  const [state, setState] = useState<UseFundingChains>({ chains: [], loading: Boolean(baseUrl), error: null })

  useEffect(() => {
    if (!baseUrl) {
      setState({ chains: [], loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    fetch(`${baseUrl}/v1/funding/chains`)
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

  return state
}

/** Nominal source amount (in base units) used only to mint an open, route-bound deposit address.
 * 10 whole tokens = 10 · 10^decimals = "1" followed by (decimals + 1) zeros. */
export function nominalUnits(decimals: number): string {
  return `1${'0'.repeat(decimals + 1)}`
}
