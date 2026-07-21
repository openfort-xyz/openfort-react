'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingMethods } from '../../../hooks/openfort/useFundingMethods'
import { useFundingTarget } from '../../../hooks/openfort/useFundingTarget'
import { totalFee, useOnrampQuote } from '../../../hooks/openfort/useOnrampQuote'
import { useUser } from '../../../hooks/openfort/useUser'
import { isWalletPayMethod, needsWalletPayCapture } from '../../../hooks/openfort/walletPay'
import useLocales from '../../../hooks/useLocales'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import Checkbox from '../../Common/Checkbox'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import { getAssetSymbol, isSameToken, sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'
import { resolveOnrampNetwork } from './onrampApi'
import { SOLANA_BUY_CURRENCIES } from './solanaCurrencies'
import {
  AmountColumnCard,
  AmountRow,
  AmountRowInput,
  ChainLogoImg,
  ContinueButtonWrapper,
  ConversionLine,
  CurrencySelect,
  PresetButton,
  PresetList,
  SelectorRight,
  SelectorTitle,
  SummaryLabel,
  SummaryMuted,
  SummaryRow,
  SummarySection,
  SummaryValue,
  TokenPillButton,
  TokenPillContent,
  TokenPillLogo,
} from './styles'
import { createCurrencyFormatter, getCurrencySymbol } from './utils'

const amountPresets = [10, 20, 50]

// Fiat source currencies the onramp accepts. Kept small; USD is the safe default
// (some providers reject non-USD and fall back to the buyer's local currency).
const SOURCE_CURRENCIES = ['USD', 'EUR', 'GBP']

// Coinbase Guest-Checkout requires the buyer to accept these before a native
// wallet-pay order. TODO: confirm the exact required wording/links against
// Coinbase's Guest Checkout integration terms before go-live.
const COINBASE_TERMS_URL = 'https://www.coinbase.com/legal/user_agreement'
const COINBASE_PRIVACY_URL = 'https://www.coinbase.com/legal/privacy'

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

const hideBrokenImg = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

const Buy = () => {
  const { buyForm, setBuyForm, setRoute, triggerResize } = useOpenfort()
  const locales = useLocales()
  const { chainType } = useOpenfortCore()
  const { user } = useUser()

  // Apple/Google Pay MAY commit a Coinbase NATIVE order (US buyer + project
  // CDP creds) — then the buyer must accept Coinbase's Guest-Checkout terms
  // here (we stamp agreementAcceptedAt) and verify email + phone before the
  // commit. Everywhere else the server resolves them to the HOSTED checkout
  // (iframe angle), which needs neither; the resolved angle decides.
  const isWalletPay = isWalletPayMethod(buyForm.method)
  const [consented, setConsented] = useState(false)
  const { data: ethAssets } = useEthereumWalletAssets()
  // Solana wallets buy Solana currencies (USDC default, then SOL); EVM reads its
  // own assets. Both hooks run unconditionally; the active chain picks the list.
  const assets = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : ethAssets

  // The destination chain is fixed by the wallet's active network — shown
  // read-only on the preview; the labels come from the display map above.
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const address = wallet.status === 'connected' ? wallet.address : undefined
  const chainId =
    wallet.status === 'connected' && chainType === ChainTypeEnum.EVM
      ? (wallet as typeof ethereumWallet).chainId
      : undefined
  const network = resolveOnrampNetwork(chainType, chainId)
  const chainLabel = network ? (CHAIN_LABEL[network] ?? network.charAt(0).toUpperCase() + network.slice(1)) : ''
  const chainLogo = chainLogoUrl(chainId)

  // The fiat rail commits into a funding session (same state machine as the
  // crypto rails). A session accepts a single payment method, so this screen
  // mints a fresh one per mount — returning here after an attempt re-mints.
  const target = useFundingTarget()
  const { createSession, isAvailable } = useFunding({ useBackendUrl: true })
  const [session, setSession] = useState<{ id: string; clientSecret: string } | null>(null)
  const sessionKey = useRef('')
  const createSessionRef = useRef(createSession)
  createSessionRef.current = createSession
  useEffect(() => {
    if (!isAvailable || !address) return
    const key = `${target.chain}|${target.currency}|${address}`
    if (sessionKey.current === key) return
    sessionKey.current = key
    let cancelled = false
    setSession(null)
    createSessionRef
      .current({ chain: target.chain, currency: target.currency, address })
      .then((s) => {
        if (!cancelled) setSession({ id: s.id, clientSecret: s.clientSecret })
      })
      .catch(() => {
        // The quote and Continue stay disabled; the commit screen surfaces errors.
        if (!cancelled) setSession(null)
      })
    return () => {
      cancelled = true
      sessionKey.current = ''
    }
  }, [isAvailable, address, target.chain, target.currency])

  // Whether THIS buyer's wallet-pay resolves to the native sheet or the hosted
  // checkout — server-decided per region + project creds. Until the resolve
  // lands (or when the row is missing) we assume native, the safe direction:
  // identity capture is never skipped when the commit will require it.
  const fundingMethods = useFundingMethods(isWalletPay ? session : null, { useBackendUrl: true })
  const methodId = backendMethodId(buyForm.method)
  const resolvedRow = fundingMethods.methods.find((m) => m.method === methodId)
  // Hold Continue only while the resolve is in flight; once settled, a missing
  // row (resolve failed / older backend) keeps the native assumption.
  const walletPayAngleKnown = !isWalletPay || fundingMethods.loaded
  const isNativeWalletPay = isWalletPay && (resolvedRow ? resolvedRow.angle === 'native' : true)

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
  const tokenLogo = currencyLogoUrl(tokenSymbol)

  const currencyFormatter = useMemo(() => createCurrencyFormatter(buyForm.currency), [buyForm.currency])
  const currencySymbol = useMemo(() => getCurrencySymbol(buyForm.currency), [buyForm.currency])

  // A real quote priced by the provider the commit would resolve — refreshes as
  // the amount/currency settle. Re-measure the modal when it appears/disappears.
  const { quote, loading: quoteLoading } = useOnrampQuote({
    session,
    method: backendMethodId(buyForm.method),
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
    if (fiatAmount === null || fiatAmount <= 0 || !session || !walletPayAngleKnown) return
    if (isNativeWalletPay) {
      if (!consented) return
      // Stamp the Guest-Checkout consent now; verify contact next (or skip
      // straight to commit when the buyer's identity is already complete).
      const agreementAcceptedAt = new Date().toISOString()
      if (needsWalletPayCapture(user)) {
        setBuyForm((prev) => ({
          ...prev,
          session,
          walletPayAngle: 'native',
          walletPay: { email: user?.email, phoneNumber: user?.phoneNumber, agreementAcceptedAt },
        }))
        setRoute(routes.BUY_WALLET_PAY_CONTACT)
      } else {
        setBuyForm((prev) => ({
          ...prev,
          session,
          walletPayAngle: 'native',
          walletPay: {
            email: user?.email,
            phoneNumber: user?.phoneNumber,
            phoneNumberVerifiedAt: agreementAcceptedAt,
            agreementAcceptedAt,
          },
        }))
        setRoute(routes.BUY_PROCESSING)
      }
      return
    }
    // Card, bank transfer, and hosted-checkout wallet pay commit directly — the
    // server resolves the provider (never shown to the user) and the hosted
    // checkout collects its own consent, so no identity capture here.
    setBuyForm((prev) => ({ ...prev, session, walletPayAngle: isWalletPay ? 'iframe' : null }))
    setRoute(routes.BUY_PROCESSING)
  }

  const handleBack = () => {
    // Card/Apple Pay is reached via the Add funds hub — back returns there.
    setRoute(routes.DEPOSIT)
  }

  const isPresetSelected = (value: number) => pressedPreset === value
  const step1Disabled =
    fiatAmount === null || fiatAmount <= 0 || !session || !walletPayAngleKnown || (isNativeWalletPay && !consented)

  // The secondary line is the real conversion: how much of the token the entered
  // fiat buys, from the live quote. Falls back to the fiat value when no quote.
  const conversionText = quote
    ? `≈ ${formatTokenAmount(quote.destinationAmount)} ${tokenSymbol}`
    : quoteLoading && fiatAmount !== null
      ? `≈ … ${tokenSymbol}`
      : fiatAmount !== null
        ? currencyFormatter.format(fiatAmount)
        : `${currencySymbol}0.00`
  const feeText = quote ? currencyFormatter.format(totalFee(quote)) : null

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>{locales.buyScreen_heading}</ModalHeading>

      <AmountColumnCard>
        <AmountRow>
          <AmountRowInput
            value={buyForm.amount}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            placeholder="0"
            inputMode="decimal"
            autoComplete="off"
          />
          <TokenPillButton type="button" onClick={handleOpenTokenSelector} title={tokenName}>
            <TokenPillContent>
              <TokenPillLogo>
                <AssetChainLogo assetLogo={tokenLogo ?? ''} chainLogo={chainLogo ?? ''} symbol={tokenSymbol} />
              </TokenPillLogo>
              <SelectorTitle>{tokenSymbol || 'Select'}</SelectorTitle>
            </TokenPillContent>
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
          </TokenPillButton>
        </AmountRow>
        <ConversionLine>{conversionText}</ConversionLine>
      </AmountColumnCard>

      <PresetList style={{ marginTop: 14 }}>
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

      <SummarySection>
        <SummaryRow>
          <SummaryLabel>Pay in</SummaryLabel>
          <CurrencySelect value={buyForm.currency} onChange={handleCurrencyChange}>
            {SOURCE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </CurrencySelect>
        </SummaryRow>
        <SummaryRow>
          <SummaryLabel>Destination</SummaryLabel>
          <SummaryValue>
            {chainLogo && <ChainLogoImg src={chainLogo} alt="" width={16} height={16} onError={hideBrokenImg} />}
            {chainLabel || '—'}
          </SummaryValue>
        </SummaryRow>
        {feeText && (
          <SummaryRow>
            <SummaryLabel>Fee</SummaryLabel>
            <SummaryMuted>{feeText}</SummaryMuted>
          </SummaryRow>
        )}
      </SummarySection>

      {isNativeWalletPay && walletPayAngleKnown && (
        <ModalBody style={{ marginTop: 14 }}>
          <Checkbox checked={consented} onChange={setConsented}>
            I agree to Coinbase's{' '}
            <a href={COINBASE_TERMS_URL} target="_blank" rel="noopener noreferrer">
              User Agreement
            </a>{' '}
            and{' '}
            <a href={COINBASE_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            , and authorize this purchase.
          </Checkbox>
        </ModalBody>
      )}

      <ContinueButtonWrapper>
        <Button variant="primary" onClick={handleContinue} disabled={step1Disabled}>
          Continue
        </Button>
      </ContinueButtonWrapper>
    </PageContent>
  )
}

export default Buy
