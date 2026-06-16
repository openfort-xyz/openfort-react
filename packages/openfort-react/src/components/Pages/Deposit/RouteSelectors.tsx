'use client'

import type { SyntheticEvent } from 'react'
import { bareSelect, field, logoImg, selectWrap, twoCol } from './formStyles'
import { chainLogo, tokenLogo, tokensFor } from './sources'

const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

type SourceChain = { id: string; name: string }

type RouteSelectorsProps = {
  chains: SourceChain[]
  chain: string
  token: string
  /** Label above the chain selector ("Supported chain" vs "Network"). */
  chainLabel: string
  onChainChange: (chain: string) => void
  onTokenChange: (token: string) => void
}

/** The source chain + token selectors shared by every deposit route. */
export function RouteSelectors({
  chains,
  chain,
  token,
  chainLabel,
  onChainChange,
  onTokenChange,
}: RouteSelectorsProps) {
  const tokens = tokensFor(chain)
  return (
    <div style={twoCol}>
      <label style={field}>
        {chainLabel}
        <div style={selectWrap}>
          <img src={chainLogo(chain)} alt="" style={logoImg} onError={hideBrokenLogo} />
          <select style={bareSelect} value={chain} onChange={(e) => onChainChange(e.target.value)}>
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
          <img src={tokenLogo(chain, token)} alt="" style={logoImg} onError={hideBrokenLogo} />
          <select style={bareSelect} value={token} onChange={(e) => onTokenChange(e.target.value)}>
            {tokens.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </label>
    </div>
  )
}
