'use client'

/**
 * Solana token picker for the send flow.
 *
 * Lists the connected wallet's holdings (native SOL + SPL tokens) with a positive
 * balance, writes the chosen one to `sendForm.asset`, and returns to the Solana
 * Send screen. The SVM counterpart of {@link SelectToken}.
 */

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { symbolToColor, TOKEN_LOGO } from '../../../constants/logos'
import { useSolanaWalletAssets } from '../../../solana/hooks/useSolanaWalletAssets'
import { ModalHeading } from '../../Common/Modal/styles'
import { type Asset, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import {
  EmptyState,
  SelectTokenContent,
  TokenBalance,
  TokenButton,
  TokenInfo,
  TokenLeftGroup,
  TokenList,
  TokenLogoArea,
  TokenLogoFallback,
  TokenLogoImg,
  TokenName,
  TokenSymbol,
} from './styles'

const ZERO = BigInt(0)

function SolanaTokenLogo({ symbol }: { symbol: string }) {
  const [imgError, setImgError] = useState(false)
  const url = TOKEN_LOGO[symbol.toUpperCase()] ?? null

  return (
    <TokenLogoArea>
      {url && !imgError ? (
        <TokenLogoImg src={url} alt={symbol} onError={() => setImgError(true)} />
      ) : (
        <TokenLogoFallback $bg={symbolToColor(symbol)}>{symbol.charAt(0).toUpperCase()}</TokenLogoFallback>
      )}
    </TokenLogoArea>
  )
}

export const SolanaSelectToken = () => {
  const { setSendForm, setRoute, triggerResize } = useOpenfort()
  const { data, isLoading } = useSolanaWalletAssets()

  const tokens = (data ?? []).filter((t) => t.amount > ZERO)

  useEffect(() => {
    if (!isLoading) triggerResize()
  }, [isLoading, triggerResize])

  const handleSelect = (token: NonNullable<typeof data>[number]) => {
    const asset: Asset = token.isNative
      ? {
          type: 'native',
          balance: token.amount,
          metadata: { symbol: 'SOL', decimals: token.decimals, fiat: { value: 0, currency: 'USD' } },
        }
      : {
          type: 'spl',
          address: token.mint,
          balance: token.amount,
          metadata: { symbol: token.symbol, name: token.name, decimals: token.decimals },
        }

    setSendForm((prev) => ({ ...prev, asset, amount: '' }))
    setRoute(routes.SOL_SEND)
  }

  return (
    <SelectTokenContent onBack={routes.SOL_SEND}>
      <ModalHeading>Select asset</ModalHeading>
      {tokens.length === 0 ? (
        <EmptyState>{isLoading ? 'Loading balances…' : 'No assets found'}</EmptyState>
      ) : (
        <TokenList>
          {tokens.map((token) => {
            const amount = Number(formatUnits(token.amount, token.decimals))
            const balanceStr = `${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${token.symbol}`
            return (
              <TokenButton key={token.mint} type="button" onClick={() => handleSelect(token)}>
                <TokenLeftGroup>
                  <SolanaTokenLogo symbol={token.symbol} />
                  <TokenInfo style={{ textAlign: 'left' }}>
                    <TokenSymbol>{token.name}</TokenSymbol>
                    <TokenName>{token.symbol}</TokenName>
                  </TokenInfo>
                </TokenLeftGroup>
                <TokenBalance>{balanceStr}</TokenBalance>
              </TokenButton>
            )
          })}
        </TokenList>
      )}
    </SelectTokenContent>
  )
}
