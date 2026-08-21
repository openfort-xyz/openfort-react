'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets.js'
import { NATIVE_TOKEN_ADDRESS } from '../../../hooks/openfort/fundingSources.js'
import { fetchOnrampMethods } from '../../../hooks/openfort/onrampMethodsApi.js'
import { useFundingTarget } from '../../../hooks/openfort/useFundingTarget.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { Arrow, ArrowChevron, TextLinkButton } from '../../Common/Button/styles.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import { type Asset, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { evmBuyCurrencies } from '../Buy/evmCurrencies.js'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies.js'
import { AssetChainLogo } from '../Deposit/AssetChainLogo.js'
import { formatBalanceWithSymbol, getAssetDecimals, getAssetSymbol } from '../Send/utils.js'
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
} from './styles.js'

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `viewAllAssets` is the trigger — expanding the list changes the page height
  useEffect(() => {
    triggerResize()
  }, [viewAllAssets, triggerResize])

  const chainType = useOpenfortCore((s) => s.chainType)
  const { chainId } = useEthereumEmbeddedWallet()
  const { data: walletAssets, isLoading: isBalancesLoading } = useEthereumWalletAssets()
  const { publishableKey, uiConfig } = useOpenfort()
  const fundingTarget = useFundingTarget()

  // Buy flow: only offer assets the onramp providers can actually deliver for
  // this destination + the buyer's region (server-resolved; chaining-aware).
  // Until the probes settle every candidate shows; assets that resolve to no
  // method are then dropped rather than failing at commit.
  const [buyable, setBuyable] = useState<Record<string, boolean> | null>(null)
  const buyCandidates = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : evmBuyCurrencies(fundingTarget.chain)
  useEffect(() => {
    if (!isBuyFlow) return
    let active = true
    const country = uiConfig.funding?.country
    Promise.all(
      buyCandidates.map(async (asset) => {
        const currency = asset.type === 'native' ? NATIVE_TOKEN_ADDRESS : (asset.address as string)
        const methods = await fetchOnrampMethods({
          targetChain: fundingTarget.chain,
          targetCurrency: currency,
          publishableKey,
          country,
        })
        return [getAssetSymbol(asset), methods.length > 0] as const
      })
    ).then((entries) => {
      if (active) setBuyable(Object.fromEntries(entries))
    })
    return () => {
      active = false
    }
  }, [isBuyFlow, buyCandidates, fundingTarget.chain, publishableKey, uiConfig.funding?.country])

  // Buys pick from a fixed buyable-currency list (USDC first, then native) per
  // chain family, so the picker always has options even for a fresh wallet with no
  // indexed balances. The send flow reads the EVM wallet's actual assets.
  const selectableTokens = isBuyFlow
    ? buyCandidates.filter((asset) => buyable === null || buyable[getAssetSymbol(asset)] !== false)
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers — the token count sets the list height and the flow decides which list is shown
  useEffect(() => {
    triggerResize()
  }, [selectableTokens.length, isBuyFlow, triggerResize])

  const renderContent = () => {
    if (!selectableTokens.length) {
      if (isBuyFlow) {
        return <EmptyState>Buying isn't available for this destination in your region.</EmptyState>
      }
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
