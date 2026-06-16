'use client'

import type { SyntheticEvent } from 'react'
import type { FundingChain } from '../../../hooks/openfort/useFundingChains'
import { bareSelect, field, logoImg, selectWrap, twoCol } from './formStyles'

const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

type RouteSelectorsProps = {
  chains: FundingChain[]
  chain: string
  currency: string
  /** Label above the chain selector ("Supported chain" vs "Network"). */
  chainLabel: string
  onChainChange: (chain: string) => void
  onCurrencyChange: (currency: string) => void
}

/** The source chain + currency selectors, populated from the live Relay chain list. */
export function RouteSelectors({
  chains,
  chain,
  currency,
  chainLabel,
  onChainChange,
  onCurrencyChange,
}: RouteSelectorsProps) {
  const activeChain = chains.find((c) => c.id === chain) ?? chains[0]
  const currencies = activeChain?.currencies ?? []
  const activeCurrency = currencies.find((c) => c.symbol === currency) ?? currencies[0]

  return (
    <div style={twoCol}>
      <label style={field}>
        {chainLabel}
        <div style={selectWrap}>
          {activeChain?.logo && <img src={activeChain.logo} alt="" style={logoImg} onError={hideBrokenLogo} />}
          <select style={bareSelect} value={activeChain?.id ?? ''} onChange={(e) => onChainChange(e.target.value)}>
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </label>
      <label style={field}>
        Currency
        <div style={selectWrap}>
          {activeCurrency?.logo && <img src={activeCurrency.logo} alt="" style={logoImg} onError={hideBrokenLogo} />}
          <select
            style={bareSelect}
            value={activeCurrency?.symbol ?? ''}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={`${c.symbol}:${c.address}`} value={c.symbol}>
                {c.symbol}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  )
}
