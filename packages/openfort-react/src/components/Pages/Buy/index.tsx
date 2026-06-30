'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useMemo, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { useOnrampQuote } from '../../../hooks/openfort/useOnrampQuote'
import useLocales from '../../../hooks/useLocales'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import { ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { getAssetSymbol, isSameToken, sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'
import { resolveOnrampNetwork } from './onrampApi'
import { totalFee } from './onrampQuoteApi'
import { getProviders } from './providers'
import { SOLANA_BUY_CURRENCIES } from './solanaCurrencies'
import {
  AmountCard,
  AmountInput,
  ContinueButtonWrapper,
  PresetButton,
  PresetList,
  SelectorButton,
  SelectorContent,
  SelectorRight,
  SelectorTitle,
} from './styles'
import { createCurrencyFormatter, getCurrencySymbol } from './utils'

const amountPresets = [10, 20, 50]

// Fiat source currencies the onramp accepts. Kept small; USD is the safe default
// (some providers reject non-USD and fall back to the buyer's local currency).
const SOURCE_CURRENCIES = ['USD', 'EUR', 'GBP']

// Friendly labels for the onramp destination networks resolveOnrampNetwork returns.
const CHAIN_LABEL: Record<string, string> = {
  base: 'Base',
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  solana: 'Solana',
}

const formatTokenAmount = (raw: string): string => {
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return raw
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

const Buy = () => {
  const { buyForm, setBuyForm, setRoute, triggerResize } = useOpenfort()
  const locales = useLocales()
  const { chainType } = useOpenfortCore()
  const { data: ethAssets } = useEthereumWalletAssets()
  // Solana wallets buy Solana currencies (USDC default, then SOL); EVM reads its
  // own assets. Both hooks run unconditionally; the active chain picks the list.
  const assets = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : ethAssets

  // Resolve the onramp destination network (where the bought token lands). The
  // chain is fixed by the wallet's active network — shown read-only on the preview.
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const chainId =
    wallet.status === 'connected' && chainType === ChainTypeEnum.EVM
      ? (wallet as typeof ethereumWallet).chainId
      : undefined
  const network = resolveOnrampNetwork(chainType, chainId)
  const chainLabel = network ? (CHAIN_LABEL[network] ?? network.charAt(0).toUpperCase() + network.slice(1)) : ''

  const [pressedPreset, setPressedPreset] = useState<number | null>(null)

  const fiatAmount = useMemo(() => {
    const normalizedAmount = sanitizeForParsing(sanitizeAmountInput(buyForm.amount))
    if (!normalizedAmount) return null
    const numeric = Number(normalizedAmount)
    if (!Number.isFinite(numeric)) return null
    return numeric
  }, [buyForm.amount])

  // Trigger resize on mount
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  const matchedToken = useMemo(
    () => assets?.find((asset) => isSameToken(asset, buyForm.asset)),
    [assets, buyForm.asset]
  )

  const selectedTokenOption = matchedToken ?? assets?.[0]
  const selectedToken = selectedTokenOption ?? buyForm.asset

  const tokenSymbol = getAssetSymbol(selectedToken)
  const tokenName = (selectedToken.metadata?.name as string) || tokenSymbol

  const currencyFormatter = useMemo(() => createCurrencyFormatter(buyForm.currency), [buyForm.currency])
  const currencySymbol = useMemo(() => getCurrencySymbol(buyForm.currency), [buyForm.currency])

  // A real quote from the resolved provider — refreshes as the amount/token/currency
  // settle. Re-measure the modal when the estimate appears/disappears.
  const { quote, loading: quoteLoading } = useOnrampQuote({
    provider: buyForm.providerId,
    token: selectedToken,
    network,
    sourceCurrency: buyForm.currency,
    amount: fiatAmount,
  })
  useEffect(() => {
    triggerResize()
  }, [quote, quoteLoading, triggerResize])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setPressedPreset(null)
      setBuyForm((prev) => ({
        ...prev,
        amount: raw,
      }))
    }
  }

  const handleAmountBlur = () => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(buyForm.amount))
    if (normalized) {
      const numeric = Number(normalized)
      if (Number.isFinite(numeric) && numeric > 0) {
        setBuyForm((prev) => ({
          ...prev,
          amount: numeric.toFixed(2),
        }))
      }
    }
  }

  const handlePresetClick = (value: number) => {
    setPressedPreset(value)
    setBuyForm((prev) => ({
      ...prev,
      amount: value.toFixed(2),
    }))
  }

  const handleCurrencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const currency = event.target.value
    setBuyForm((prev) => ({ ...prev, currency }))
  }

  const handleOpenTokenSelector = () => {
    setRoute(routes.BUY_TOKEN_SELECT)
  }

  const handleContinue = () => {
    if (fiatAmount === null || fiatAmount <= 0) return
    // Provider is resolved by Openfort (set on the deposit hub); skip the picker
    // and go straight to the provider redirect.
    setRoute(routes.BUY_PROCESSING)
  }

  const providerName =
    getProviders().find((p) => p.id === buyForm.providerId)?.name ??
    (buyForm.providerId ? buyForm.providerId.charAt(0).toUpperCase() + buyForm.providerId.slice(1) : 'provider')

  const handleBack = () => {
    // Card/Apple Pay is reached via the Add funds hub — back returns there.
    setRoute(routes.DEPOSIT)
  }

  const isPresetSelected = (value: number) => pressedPreset === value
  const step1Disabled = fiatAmount === null || fiatAmount <= 0

  const receiveText = quote ? `≈ ${formatTokenAmount(quote.destinationAmount)} ${tokenSymbol}` : null
  const feeText = quote ? currencyFormatter.format(totalFee(quote)) : null

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>{locales.buyScreen_heading}</ModalHeading>

      <AmountCard style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <AmountInput
            style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
            value={buyForm.amount}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            placeholder="0"
            inputMode="decimal"
            autoComplete="off"
          />
          <SelectorButton
            type="button"
            onClick={handleOpenTokenSelector}
            style={{ width: 'auto', flex: '0 0 auto', padding: '8px 14px', borderRadius: 999 }}
            title={tokenName}
          >
            <SelectorContent>
              <SelectorTitle>{tokenSymbol || 'Select'}</SelectorTitle>
            </SelectorContent>
            <SelectorRight>
              <Arrow width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ArrowChevron
                  stroke="currentColor"
                  d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Arrow>
            </SelectorRight>
          </SelectorButton>
        </div>
        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 500, color: 'var(--ck-body-color-muted)' }}>
          {fiatAmount !== null ? currencyFormatter.format(fiatAmount) : `${currencySymbol}0.00`}
        </div>
      </AmountCard>

      <PresetList>
        {amountPresets.map((preset) => (
          <PresetButton
            key={preset}
            type="button"
            onClick={() => handlePresetClick(preset)}
            $active={isPresetSelected(preset)}
          >
            {currencyFormatter.format(preset)}
          </PresetButton>
        ))}
      </PresetList>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--ck-body-divider, rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ck-body-color-muted)' }}>Pay in</span>
          <select
            value={buyForm.currency}
            onChange={handleCurrencyChange}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              color: 'var(--ck-body-color)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'right',
              fontFamily: 'inherit',
            }}
          >
            {SOURCE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ck-body-color-muted)' }}>Destination</span>
          <span style={{ fontWeight: 600, color: 'var(--ck-body-color)' }}>
            {tokenSymbol}
            {chainLabel ? ` on ${chainLabel}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ck-body-color-muted)' }}>You receive</span>
          <span style={{ fontWeight: 600, color: 'var(--ck-body-color)' }}>
            {quoteLoading ? 'Fetching best price…' : (receiveText ?? '—')}
          </span>
        </div>
        {feeText && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--ck-body-color-muted)' }}>Fee</span>
            <span style={{ color: 'var(--ck-body-color-muted)' }}>{feeText}</span>
          </div>
        )}
      </div>

      <ContinueButtonWrapper>
        <Button variant="primary" onClick={handleContinue} disabled={step1Disabled}>
          Buy on {providerName}
        </Button>
      </ContinueButtonWrapper>
    </PageContent>
  )
}

export default Buy
