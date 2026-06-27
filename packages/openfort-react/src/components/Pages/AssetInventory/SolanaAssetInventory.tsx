'use client'

import { useEffect } from 'react'
import { formatUnits } from 'viem'
import { currencyLogoUrl } from '../../../constants/logos'
import { useSolanaWalletAssets } from '../../../solana/hooks/useSolanaWalletAssets'
import { ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import {
  ContentWrapper,
  EmptyState,
  SelectTokenContent,
  TokenContainer,
  TokenInfo,
  TokenLeftGroup,
  TokenList,
  TokenLogoArea,
  TokenName,
  TokenSymbol,
} from '../SelectToken/styles'

const ZERO = BigInt(0)

/** Token logo with the Solana chain badge, matching the EVM inventory. */
function SolanaTokenLogo({ symbol }: { symbol: string }) {
  return (
    <TokenLogoArea>
      <AssetChainLogo
        assetLogo={currencyLogoUrl(symbol) ?? ''}
        chainLogo={currencyLogoUrl('SOL') ?? ''}
        symbol={symbol}
      />
    </TokenLogoArea>
  )
}

/**
 * SVM counterpart of {@link AssetInventory}: lists the connected Solana wallet's
 * native SOL and SPL token holdings (e.g. USDC). Reached by tapping the balance on
 * the Solana connected page.
 */
export const SolanaAssetInventory = () => {
  const { data, isLoading } = useSolanaWalletAssets()
  const { triggerResize } = useOpenfort()

  useEffect(() => {
    if (!isLoading) triggerResize()
  }, [isLoading, triggerResize])

  const tokens = (data ?? []).filter((t) => t.amount > ZERO)

  if (isLoading) {
    return (
      <SelectTokenContent onBack={routes.SOL_CONNECTED}>
        <ModalHeading>Your assets</ModalHeading>
        <EmptyState>Loading balances...</EmptyState>
      </SelectTokenContent>
    )
  }

  return (
    <SelectTokenContent key="sol-assets" onBack={routes.SOL_CONNECTED}>
      <ModalHeading>Your assets</ModalHeading>
      <ContentWrapper>
        <TokenList>
          {tokens.length > 0 ? (
            tokens.map((token) => {
              const amount = Number(formatUnits(token.amount, token.decimals))
              const balanceStr = `${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${token.symbol}`
              return (
                <TokenContainer key={token.mint}>
                  <TokenLeftGroup>
                    <SolanaTokenLogo symbol={token.symbol} />
                    <TokenInfo style={{ textAlign: 'left' }}>
                      <TokenSymbol>{token.name}</TokenSymbol>
                      <TokenName>{balanceStr}</TokenName>
                    </TokenInfo>
                  </TokenLeftGroup>
                </TokenContainer>
              )
            })
          ) : (
            <EmptyState>No assets found</EmptyState>
          )}
        </TokenList>
      </ContentWrapper>
    </SelectTokenContent>
  )
}
