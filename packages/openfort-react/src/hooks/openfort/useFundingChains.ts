'use client'

import { SDKConfiguration } from '@openfort/openfort-js'
import type { QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { openfortKeys } from '../../query/queryKeys.js'
import { useQuery } from '../../query/useQuery.js'
import { getPublishableKeyEnvironment } from '../../utils/validation.js'

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

type UseFundingChains = {
  chains: FundingChain[]
  /**
   * The rail's full deliverable chain list (uncurated). Used to check whether a
   * funding TARGET chain is supported, independent of the source allowlist that
   * narrows {@link chains}.
   */
  railChains: FundingChain[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
  queryKey: QueryKey
}

/**
 * Sensible default source chains — the common funding origins. Override with
 * `uiConfig.funding.sourceChains`. Intersected with what the rail supports.
 */
const DEFAULT_SOURCE_CHAINS = [
  'eip155:42161', // Arbitrum
  'eip155:8453', // Base
  'eip155:56', // BNB Chain
  'eip155:1', // Ethereum
  'eip155:10', // Optimism
  'eip155:137', // Polygon
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana
]

/**
 * Default source currencies: the chain's `'native'` currency plus the major
 * stablecoins. Override with `uiConfig.funding.sourceCurrencies`.
 */
const DEFAULT_SOURCE_CURRENCIES = ['native', 'USDC', 'USDT']

/** Shared empty list so a pending or failed fetch doesn't hand out a new array each render. */
const EMPTY_CHAINS: FundingChain[] = []

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
  const { uiConfig, publishableKey } = useOpenfort()
  // Defaults to the SDK backend (api.openfort.io); override for a custom funding service.
  const baseUrl = uiConfig.fundingBaseUrl || SDKConfiguration.getInstance()?.backendUrl || 'https://api.openfort.io'
  const sourceChains = uiConfig.funding?.sourceChains ?? DEFAULT_SOURCE_CHAINS
  const sourceCurrencies = uiConfig.funding?.sourceCurrencies ?? DEFAULT_SOURCE_CURRENCIES
  // Match the rail host to the key environment: test keys (`pk_test_…`) list the
  // testnet rail, everything else the mainnet rail. The backend picks the same
  // host from the request livemode for the authenticated session endpoints.
  const livemode = getPublishableKeyEnvironment(publishableKey) !== 'test'

  // Narrowing the provider dictionary to the selected subset is cheap (O(chains))
  // and pure, so it runs as a select: the curated and uncurated lists then stay
  // referentially stable between renders.
  const select = useCallback(
    (chains: FundingChain[]) => ({
      chains: curateChains(chains, sourceChains, sourceCurrencies),
      railChains: chains,
    }),
    [sourceChains, sourceCurrencies]
  )

  const { data, error, isLoading, isFetching, refetch, queryKey } = useQuery({
    queryKey: openfortKeys.fundingChains({ baseUrl, livemode }),
    queryFn: async () => {
      const response = await fetch(`${baseUrl}/v2/funding/chains?livemode=${livemode}`)
      if (!response.ok) throw new Error(`Failed to load chains (${response.status})`)
      const body = (await response.json()) as { chains?: FundingChain[] }
      return body.chains ?? []
    },
    select,
    staleTime: 5 * 60 * 1000,
  })

  return {
    chains: data?.chains ?? EMPTY_CHAINS,
    railChains: data?.railChains ?? EMPTY_CHAINS,
    isLoading,
    isFetching,
    error,
    refetch,
    queryKey,
  }
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
 * The open address accepts any amount >= the route minimum afterward, so this is just a quote seed.
 * Stablecoins use 1 whole unit (~$1, clears mainnet route minimums); native tokens are far pricier
 * per unit (1 ETH ≈ thousands), so they use 0.01 of a unit to avoid minting/QR-prefilling 1 whole ETH. */
export function nominalUnits(decimals: number, native = false): string {
  const zeros = native ? Math.max(0, decimals - 2) : decimals
  return `1${'0'.repeat(zeros)}`
}
