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
  token: string
  /** Label above the chain selector ("Supported chain" vs "Network"). */
  chainLabel: string
  onChainChange: (chain: string) => void
  onTokenChange: (token: string) => void
}

/** The source chain + token selectors, populated from the live Relay chain list. */
export function RouteSelectors({
  chains,
  chain,
  token,
  chainLabel,
  onChainChange,
  onTokenChange,
}: RouteSelectorsProps) {
  const activeChain = chains.find((c) => c.id === chain) ?? chains[0]
  const tokens = activeChain?.tokens ?? []
  const activeToken = tokens.find((t) => t.symbol === token) ?? tokens[0]

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
        Token
        <div style={selectWrap}>
          {activeToken?.logo && <img src={activeToken.logo} alt="" style={logoImg} onError={hideBrokenLogo} />}
          <select style={bareSelect} value={activeToken?.symbol ?? ''} onChange={(e) => onTokenChange(e.target.value)}>
            {tokens.map((t) => (
              <option key={`${t.symbol}:${t.address}`} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  )
}
