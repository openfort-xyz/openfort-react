'use client'

import type { FundingChain } from '../../../hooks/openfort/useFundingChains'
import { field, twoCol } from './formStyles'
import { LogoSelect } from './LogoSelect'
import { Skeleton } from './styles'

type RouteSelectorsProps = {
  chains: FundingChain[]
  chain: string
  currency: string
  /** Label above the chain selector ("Supported chain" vs "Network"). */
  chainLabel: string
  onChainChange: (chain: string) => void
  onCurrencyChange: (currency: string) => void
}

/** The source chain + currency selectors (logo-aware dropdowns), from the live Relay list. */
export function RouteSelectors({
  chains,
  chain,
  currency,
  chainLabel,
  onChainChange,
  onCurrencyChange,
}: RouteSelectorsProps) {
  // Chains still loading — show placeholder selectors instead of empty dropdowns.
  if (chains.length === 0) {
    return (
      <div style={twoCol}>
        <div style={field}>
          {chainLabel}
          <Skeleton $h="40px" $r="8px" />
        </div>
        <div style={field}>
          Currency
          <Skeleton $h="40px" $r="8px" />
        </div>
      </div>
    )
  }

  const activeChain = chains.find((c) => c.id === chain) ?? chains[0]
  const currencies = activeChain?.currencies ?? []

  return (
    <div style={twoCol}>
      <div style={field}>
        {chainLabel}
        <LogoSelect
          value={activeChain?.id ?? ''}
          onChange={onChainChange}
          options={chains.map((c) => ({ value: c.id, label: c.name, logo: c.logo }))}
        />
      </div>
      <div style={field}>
        Currency
        <LogoSelect
          value={currency}
          onChange={onCurrencyChange}
          options={currencies.map((c) => ({ value: c.symbol, label: c.symbol, logo: c.logo }))}
        />
      </div>
    </div>
  )
}
