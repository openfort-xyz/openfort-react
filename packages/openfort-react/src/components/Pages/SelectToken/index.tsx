'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { Arrow, ArrowChevron, TextLinkButton } from '../../Common/Button/styles'
import { ModalHeading } from '../../Common/Modal/styles'
import { type Asset, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { EVM_BUY_CURRENCIES } from '../Buy/evmCurrencies'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import { formatBalanceWithSymbol, getAssetDecimals, getAssetSymbol } from '../Send/utils'
import {
  EmptyState,
  SelectTokenContent,
  TokenBalance,
  TokenButton,
  TokenInfo,
  TokenLeftGroup,
  TokenList,
  TokenLogoArea,
  TokenName,
  TokenSymbol,
} from './styles'

const ZERO = BigInt(0)
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const SelectToken = ({ isBuyFlow }: { isBuyFlow: boolean }) => {
  const { setSendForm, setBuyForm, setRoute, triggerResize } = useOpenfort()

  const [viewAllAssets, setViewAllAssets] = useState(false)

  useEffect(() => {
    triggerResize()
  }, [viewAllAssets])

  const { chainType } = useOpenfortCore()
  const { chainId } = useEthereumEmbeddedWallet()
  const { data: walletAssets, isLoading: isBalancesLoading } = useEthereumWalletAssets()

  // Buys pick from a fixed buyable-currency list (USDC first, then native) per
  // chain family, so the picker always has options even for a fresh wallet with no
  // indexed balances. The send flow reads the EVM wallet's actual assets.
  const selectableTokens = isBuyFlow
    ? chainType === ChainTypeEnum.SVM
      ? SOLANA_BUY_CURRENCIES
      : EVM_BUY_CURRENCIES
    : walletAssets || []

  const handleSelect = (asset: Asset) => {
    // In send flow, don't allow selecting tokens with 0 balance
    if (!isBuyFlow && (asset.balance ?? ZERO) <= ZERO) {
      return
    }

    if (isBuyFlow) {
      setBuyForm((prev) => ({
        ...prev,
        asset,
      }))
      setRoute(routes.BUY)
      return
    }

    setSendForm((prev) => ({
      ...prev,
      asset,
      amount: '', // Always reset amount when selecting a token
    }))
    setRoute(routes.SEND)
  }

  useEffect(() => {
    triggerResize()
  }, [selectableTokens.length, isBuyFlow])

  const renderContent = () => {
    if (!selectableTokens.length) {
      if (isBalancesLoading) {
        return <EmptyState>Loading balances…</EmptyState>
      }
      return <EmptyState>No supported tokens found for this network yet.</EmptyState>
    }

    return (
      <TokenList>
        {selectableTokens.map((token) => {
          const key = token.type === 'erc20' ? token.address : 'native'
          const displaySymbol = getAssetSymbol(token)
          const displayName = (token.metadata?.name as string) || displaySymbol || 'Unknown Token'
          // const symbolKey = token.metadata?.symbol?.toUpperCase()
          const decimals = getAssetDecimals(token)

          const pricePerToken = token.metadata?.fiat?.value
          let usdValue: string | null = null

          // Show loading state for balances
          const isBalanceLoaded = token.balance !== undefined
          const balanceDisplay = isBalanceLoaded
            ? formatBalanceWithSymbol(token.balance, decimals, token.metadata?.symbol || '')
            : 'Loading...'

          // Check if token has zero balance (for send flow opacity)
          const hasZeroBalance = isBalanceLoaded && (token.balance ?? ZERO) <= ZERO

          if (hasZeroBalance && !viewAllAssets && !isBuyFlow) return null

          const isDisabled = !isBuyFlow && hasZeroBalance

          if (isBalanceLoaded && pricePerToken !== undefined && token.balance !== undefined) {
            const amount = parseFloat(formatUnits(token.balance, decimals))
            if (Number.isFinite(amount)) {
              const totalUsd = amount * pricePerToken
              if (totalUsd >= 0.01) {
                usdValue = usdFormatter.format(totalUsd)
              } else if (totalUsd > 0) {
                usdValue = '<$0.01'
              } else {
                usdValue = usdFormatter.format(0)
              }
            }
          }

          return (
            <TokenButton
              key={key}
              type="button"
              onClick={() => handleSelect(token)}
              style={{ opacity: isDisabled ? 0.4 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
            >
              <TokenLeftGroup>
                <TokenLogoArea>
                  <AssetChainLogo
                    assetLogo={currencyLogoUrl(displaySymbol) ?? ''}
                    chainLogo={chainLogoUrl(chainId) ?? ''}
                    symbol={displaySymbol}
                  />
                </TokenLogoArea>
                <TokenInfo>
                  <TokenSymbol>{displayName}</TokenSymbol>
                  {isBuyFlow && <TokenName>{displaySymbol}</TokenName>}
                </TokenInfo>
              </TokenLeftGroup>
              {isBuyFlow ? (
                <Arrow width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ArrowChevron stroke="currentColor" d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314" />
                </Arrow>
              ) : (
                <TokenInfo>
                  <TokenBalance>{balanceDisplay}</TokenBalance>
                  {usdValue ? <TokenName style={{ textAlign: 'end' }}>{usdValue}</TokenName> : null}
                </TokenInfo>
              )}
            </TokenButton>
          )
        })}
        {!isBuyFlow && (
          <TextLinkButton
            type="button"
            onClick={() => {
              setViewAllAssets(!viewAllAssets)
            }}
          >
            {viewAllAssets ? 'View less assets' : 'View all assets'}
          </TextLinkButton>
        )}
      </TokenList>
    )
  }

  return (
    <SelectTokenContent>
      <ModalHeading>Select asset</ModalHeading>
      {renderContent()}
    </SelectTokenContent>
  )
}

export default SelectToken
