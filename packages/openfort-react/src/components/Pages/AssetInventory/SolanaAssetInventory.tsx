'use client'

import { useEffect, useMemo } from 'react'
import { formatUnits } from 'viem'
import { currencyLogoUrl } from '../../../constants/logos.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import { useSolanaWalletAssets } from '../../../solana/hooks/useSolanaWalletAssets.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { AssetChainLogo } from '../Deposit/AssetChainLogo.js'
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
} from '../SelectToken/styles.js'

const ZERO = BigInt(0)

const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
const USDT_MINT_MAINNET = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

type SolanaToken = { mint: string; symbol: string; name: string; amount: bigint; decimals: number; isNative: boolean }

/**
 * Default tokens to surface at zero balance: native SOL plus the stablecoins we
 * ship verified mints for (USDC on the active cluster, USDT on mainnet). Skips any
 * already held.
 */
function buildSolanaDefaults(cluster: string | undefined, held: SolanaToken[]): SolanaToken[] {
  const isMainnet = cluster === 'mainnet-beta' || cluster === 'mainnet'
  const heldMints = new Set(held.map((t) => t.mint))
  const defaults: SolanaToken[] = []

  if (!heldMints.has('native')) {
    defaults.push({ mint: 'native', symbol: 'SOL', name: 'Solana', amount: ZERO, decimals: 9, isNative: true })
  }
  const usdcMint = isMainnet ? USDC_MINT_MAINNET : USDC_MINT_DEVNET
  if (!heldMints.has(usdcMint)) {
    defaults.push({ mint: usdcMint, symbol: 'USDC', name: 'USD Coin', amount: ZERO, decimals: 6, isNative: false })
  }
  if (isMainnet && !heldMints.has(USDT_MINT_MAINNET)) {
    defaults.push({
      mint: USDT_MINT_MAINNET,
      symbol: 'USDT',
      name: 'Tether USD',
      amount: ZERO,
      decimals: 6,
      isNative: false,
    })
  }
  return defaults
}

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
  const wallet = useSolanaEmbeddedWallet()
  const cluster = wallet.cluster

  useEffect(() => {
    if (!isLoading) triggerResize()
  }, [isLoading, triggerResize])

  // Held tokens first, then default zero-balance tokens (SOL + stablecoins) so the
  // list is never empty.
  const tokens = useMemo(() => {
    const held = (data ?? []).filter((t) => t.amount > ZERO)
    return [...held, ...buildSolanaDefaults(cluster, held)]
  }, [data, cluster])

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
