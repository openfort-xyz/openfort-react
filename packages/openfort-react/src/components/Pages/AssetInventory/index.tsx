import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { symbolToColor, TOKEN_LOGO } from '../../../constants/logos'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import Chain from '../../Common/Chain'
import { ModalHeading } from '../../Common/Modal/styles'
import type { MultiChainAsset } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import {
  ChainBadge,
  ChainGroup,
  ChainGroupHeader,
  ContentWrapper,
  EmptyState,
  InfoLink,
  SelectTokenContent,
  TokenBalance,
  TokenContainer,
  TokenInfo,
  TokenLeftGroup,
  TokenList,
  TokenLogoArea,
  TokenLogoFallback,
  TokenLogoImg,
  TokenName,
  TokenPill,
  TokenPillSymbol,
  TokenSymbol,
} from '../SelectToken/styles'

import { getAssetDecimals, getAssetSymbol } from '../Send/utils'

const ZERO = BigInt(0)
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

function getTokenLogoUrl(token: MultiChainAsset): string | null {
  const symbol = getAssetSymbol(token).toUpperCase()
  return TOKEN_LOGO[symbol] ?? null
}

function TokenLogo({ token }: { token: MultiChainAsset }) {
  const [imgError, setImgError] = useState(false)
  const symbol = getAssetSymbol(token)
  const logoUrl = getTokenLogoUrl(token)

  return (
    <TokenLogoArea>
      {logoUrl && !imgError ? (
        <TokenLogoImg src={logoUrl} alt={symbol} onError={() => setImgError(true)} />
      ) : (
        <TokenLogoFallback $bg={symbolToColor(symbol)}>{symbol.charAt(0).toUpperCase()}</TokenLogoFallback>
      )}
      <ChainBadge>
        <Chain id={token.chainId} unsupported={false} size={14} />
      </ChainBadge>
    </TokenLogoArea>
  )
}

function renderTokenRow(token: MultiChainAsset) {
  const key = token.type === 'erc20' ? `${token.chainId}-${token.address}` : `${token.chainId}-native`
  const displaySymbol = getAssetSymbol(token)
  const displayName = (token.metadata?.name as string) || displaySymbol || 'Unknown Token'
  const decimals = getAssetDecimals(token)

  const pricePerToken = token.metadata?.fiat?.value
  let usdValue: string | null = null
  let balanceNum = ''
  let priceDisplay: string | null = null

  const isBalanceLoaded = token.balance !== undefined
  const hasZeroBalance = isBalanceLoaded && (token.balance ?? ZERO) <= ZERO
  if (hasZeroBalance) return null

  if (isBalanceLoaded && token.balance !== undefined) {
    const amount = parseFloat(formatUnits(token.balance, decimals))
    if (Number.isFinite(amount)) {
      balanceNum = `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${displaySymbol}`

      if (pricePerToken !== undefined) {
        const totalUsd = amount * pricePerToken
        if (totalUsd >= 0.01) {
          usdValue = usdFormatter.format(totalUsd)
        } else if (totalUsd > 0) {
          usdValue = '<$0.01'
        } else {
          usdValue = usdFormatter.format(0)
        }
        priceDisplay = `@${priceFormatter.format(pricePerToken)}`
      }
    }
  }

  return (
    <TokenContainer key={key}>
      <TokenLeftGroup>
        <TokenLogo token={token} />
        <TokenInfo style={{ textAlign: 'left' }}>
          <TokenSymbol>{displayName}</TokenSymbol>
          <TokenName>{balanceNum || 'Loading...'}</TokenName>
        </TokenInfo>
      </TokenLeftGroup>
      <TokenInfo>
        {usdValue ? <TokenBalance>{usdValue}</TokenBalance> : null}
        {priceDisplay ? <TokenName style={{ textAlign: 'end' }}>{priceDisplay}</TokenName> : null}
      </TokenInfo>
    </TokenContainer>
  )
}

const PILL_LOGO_SIZE = 16

function PillLogo({ symbol }: { symbol: string }) {
  const [imgError, setImgError] = useState(false)
  const url = TOKEN_LOGO[symbol.toUpperCase()] ?? null

  if (!url || imgError) {
    return (
      <span
        style={{
          width: PILL_LOGO_SIZE,
          height: PILL_LOGO_SIZE,
          borderRadius: '50%',
          background: symbolToColor(symbol),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {symbol.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt={symbol}
      onError={() => setImgError(true)}
      style={{
        width: PILL_LOGO_SIZE,
        height: PILL_LOGO_SIZE,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  )
}

export const AssetInventory = () => {
  const { data, multiChain, isLoading: isBalancesLoading } = useEthereumWalletAssets({ multiChain: true })
  const { triggerResize, chains } = useOpenfort()
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!isBalancesLoading) triggerResize()
  }, [isBalancesLoading])

  useEffect(() => {
    triggerResize()
  }, [showDetails])

  const tokens = (multiChain ? data : null) ?? []
  const hasBalance = tokens.some((t) => t.balance > ZERO)

  const chainNameMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of chains) map.set(c.id, c.name)
    return map
  }, [chains])

  const groupedByChain = useMemo(() => {
    const groups = new Map<number, { symbol: string; name: string }[]>()
    for (const t of tokens) {
      if (!groups.has(t.chainId)) groups.set(t.chainId, [])
      groups.get(t.chainId)!.push({
        symbol: getAssetSymbol(t),
        name: (t.metadata?.name as string) || getAssetSymbol(t),
      })
    }
    return groups
  }, [tokens])

  if (isBalancesLoading) {
    return (
      <SelectTokenContent>
        <ModalHeading>Your assets</ModalHeading>
        <EmptyState>Loading balances...</EmptyState>
      </SelectTokenContent>
    )
  }

  if (showDetails) {
    return (
      <SelectTokenContent
        key="details"
        onBack={() => {
          setShowDetails(false)
        }}
      >
        <ModalHeading>Configured assets</ModalHeading>
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.26, 0.08, 0.25, 1] }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <ContentWrapper style={{ overflowY: 'auto', maxHeight: 400 }}>
            {Array.from(groupedByChain.entries()).map(([chainId, assets]) => (
              <ChainGroup key={chainId}>
                <ChainGroupHeader>
                  <Chain id={chainId} unsupported={false} size={18} />
                  {chainNameMap.get(chainId) || `Chain ${chainId}`}
                </ChainGroupHeader>
                {assets.map((a) => (
                  <TokenPill key={`${chainId}-${a.symbol}`}>
                    <PillLogo symbol={a.symbol} />
                    <TokenPillSymbol>{a.symbol}</TokenPillSymbol>
                    {a.name !== a.symbol && a.name}
                  </TokenPill>
                ))}
              </ChainGroup>
            ))}
          </ContentWrapper>
        </motion.div>
      </SelectTokenContent>
    )
  }

  return (
    <SelectTokenContent key="assets">
      <ModalHeading>Your assets</ModalHeading>
      <ContentWrapper>
        <InfoLink type="button" onClick={() => setShowDetails(true)}>
          <svg
            role="img"
            aria-label="Info"
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" />
            <path d="M7 6.25V10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="7" cy="4.25" r="0.75" fill="currentColor" />
          </svg>
          Only configured chains and tokens are shown
        </InfoLink>
        <TokenList>{hasBalance ? tokens.map(renderTokenRow) : <EmptyState>No assets found</EmptyState>}</TokenList>
      </ContentWrapper>
    </SelectTokenContent>
  )
}
