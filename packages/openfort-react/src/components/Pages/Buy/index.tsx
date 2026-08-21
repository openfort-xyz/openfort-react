'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { NATIVE_TOKEN_ADDRESS } from '../../../hooks/openfort/fundingSources'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingMethods } from '../../../hooks/openfort/useFundingMethods'
import { useFundingTarget } from '../../../hooks/openfort/useFundingTarget'
import { totalFee, useOnrampQuote } from '../../../hooks/openfort/useOnrampQuote'
import { useUser } from '../../../hooks/openfort/useUser'
import { isWalletPayMethod } from '../../../hooks/openfort/walletPay'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import { LogoSelect } from '../Deposit/LogoSelect'
import { getAssetSymbol, isSameToken, sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'
import { evmBuyCurrencies } from './evmCurrencies'
import { SOLANA_BUY_CURRENCIES } from './solanaCurrencies'
import {
  BigAmountInput,
  BigAmountRow,
  BigAmountSymbol,
  BuyHeadingButton,
  BuyHeadingLogo,
  CenteredRow,
  ContinueButtonWrapper,
  FlagBadge,
  MethodRowButton,
  SummaryLabel,
  SummaryRow,
  SummarySection,
} from './styles'
import { amountInputWidth, createCurrencyFormatter, defaultCurrencyForCountry, getCurrencySymbol } from './utils'

// Fiat source currencies the onramp actually settles. GBP is omitted on
// purpose: the provider accepts it as a parameter but currently quotes no
// destination pairs for it, so offering it only produces a dead end.
const SOURCE_CURRENCIES = ['USD', 'EUR']

// Flag shown in the currency pill (display only — the selector drives the value).
const CURRENCY_FLAG: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
}

// The payment-method switch below the amount ("Pay with card") — plain grey
// text back to the method picker, not a required step.
const METHOD_LABEL: Partial<Record<FundingMethod, string>> = {
  [FundingMethod.APPLE_PAY]: 'Apple Pay',
  [FundingMethod.GOOGLE_PAY]: 'Google Pay',
  [FundingMethod.CARD]: 'card',
  [FundingMethod.BANK_TRANSFER]: 'bank transfer',
}

const Buy = () => {
  const { buyForm, setBuyForm, setRoute, triggerResize } = useOpenfort()
  const { chainType } = useOpenfortCore()
  const { user } = useUser()

  // Apple/Google Pay MAY commit a Coinbase NATIVE order (US buyer + project
  // CDP creds) — the contact screen then collects Coinbase's Guest-Checkout
  // consent and the OTP-verified identity before the commit. Everywhere else
  // the server resolves them to an embedded or hosted checkout, which needs
  // neither; the resolved angle decides.
  const isWalletPay = isWalletPayMethod(buyForm.method)
  // The selectable BUY list per chain family — the same list the token selector
  // shows, so a picked token always matches (the wallet's indexed assets are
  // irrelevant when buying). The EVM list carries the TARGET chain's own USDC.
  const fundingTargetForList = useFundingTarget()
  const buyList = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : evmBuyCurrencies(fundingTargetForList.chain)

  // The wallet fixes the destination; only its logo is shown (in the heading).
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const address = wallet.status === 'connected' ? wallet.address : undefined
  const chainId =
    wallet.status === 'connected' && chainType === ChainTypeEnum.EVM
      ? (wallet as typeof ethereumWallet).chainId
      : undefined
  const chainLogo = chainLogoUrl(chainId)

  // The fiat rail commits into a funding session (same state machine as the
  // crypto rails). A session accepts a single payment method, so this screen
  // mints a fresh one per mount — returning here after an attempt re-mints.
  // The DELIVERED currency is the selected token (on the wallet's active
  // chain); chaining covers tokens the provider can't deliver directly.
  const matchedToken = useMemo(
    () => buyList.find((asset) => isSameToken(asset, buyForm.asset)),
    [buyList, buyForm.asset]
  )
  const selectedToken = matchedToken ?? buyList[0]

  const defaultTarget = fundingTargetForList
  const target = useMemo(
    () => ({
      chain: defaultTarget.chain,
      currency: selectedToken.type === 'native' ? NATIVE_TOKEN_ADDRESS : (selectedToken.address as string),
    }),
    [defaultTarget.chain, selectedToken]
  )
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

  // How THIS buyer's method executes — server-decided per region + project
  // creds. Wallet pay branches on native vs hosted (identity capture); every
  // method branches on Stripe's v2 element flow (`embedded` + publishable key).
  // Until the resolve lands (or when the row is missing) wallet pay assumes
  // native, the safe direction: identity capture is never skipped when the
  // commit requires it.
  const fundingMethods = useFundingMethods(session, { useBackendUrl: true })
  const methodId = backendMethodId(buyForm.method)
  const resolvedRow = fundingMethods.methods.find((m) => m.method === methodId)
  // Hold Continue only while the resolve is in flight; once settled, a missing
  // row (resolve failed / older backend) keeps the native assumption.
  const walletPayAngleKnown = !isWalletPay || fundingMethods.loaded
  const isNativeWalletPay = isWalletPay && (resolvedRow ? resolvedRow.angle === 'native' : true)
  // Stripe's v2 Link-auth flow: the elements collect auth + payment in the
  // widget BEFORE the commit, so it needs its own screen (and the row's key).
  const stripeLinkKey =
    resolvedRow?.angle === 'embedded' && resolvedRow.providerPublishableKey ? resolvedRow.providerPublishableKey : null

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

  // Price in the buyer's regional currency once the server resolves their
  // country (it accounts for the IP and any override, so it is the same region
  // the commit will route with). A currency the buyer picked themselves wins.
  // The country itself is carried on the form for the checkout screens, which
  // otherwise fall back to the optional configured country.
  useEffect(() => {
    if (!fundingMethods.country) return
    const regional = defaultCurrencyForCountry(fundingMethods.country)
    setBuyForm((prev) => ({
      ...prev,
      buyerCountry: fundingMethods.country,
      ...(prev.currencyPinned || prev.currency === regional ? {} : { currency: regional }),
    }))
  }, [fundingMethods.country, setBuyForm])

  const tokenSymbol = getAssetSymbol(selectedToken)
  const tokenName = (selectedToken.metadata?.name as string) || tokenSymbol
  const tokenLogo = currencyLogoUrl(tokenSymbol)

  const currencyFormatter = useMemo(() => createCurrencyFormatter(buyForm.currency), [buyForm.currency])
  const currencySymbol = useMemo(() => getCurrencySymbol(buyForm.currency), [buyForm.currency])

  // A real quote priced by the provider the commit would resolve — refreshes as
  // the amount/currency settle; shown only as the fee line (the amount itself
  // always stays in the buyer's chosen fiat currency).
  const { quote } = useOnrampQuote({
    session,
    method: methodId,
    sourceCurrency: buyForm.currency,
    amount: fiatAmount,
  })
  useEffect(() => {
    triggerResize()
  }, [quote, triggerResize])

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
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

  const handleOpenTokenSelector = () => {
    setRoute(routes.BUY_TOKEN_SELECT)
  }

  const handleContinue = () => {
    if (fiatAmount === null || fiatAmount <= 0 || !session || !walletPayAngleKnown) return
    if (isNativeWalletPay) {
      // The contact screen owns the identity: Coinbase's Guest-Checkout consent
      // plus OTP-verified email + phone. Pieces already verified (60-day
      // records) are skipped there, so the fast path is one consent tap.
      setBuyForm((prev) => ({
        ...prev,
        session,
        walletPayAngle: 'native',
        walletPay: { email: user?.email, phoneNumber: user?.phoneNumber },
      }))
      setRoute(routes.BUY_WALLET_PAY_CONTACT)
      return
    }
    // Stripe's v2 element flow authenticates + collects the payment method in
    // the widget before committing — its screen owns the whole checkout.
    if (stripeLinkKey) {
      setBuyForm((prev) => ({
        ...prev,
        session,
        walletPayAngle: isWalletPay ? 'popup' : null,
        stripeLink: { publishableKey: stripeLinkKey },
      }))
      setRoute(routes.BUY_STRIPE_LINK)
      return
    }
    // Card, bank transfer, and embedded/hosted wallet pay commit directly — the
    // server resolves the provider (never shown to the user) and the checkout
    // collects its own consent, so no identity capture here.
    setBuyForm((prev) => ({ ...prev, session, walletPayAngle: isWalletPay ? 'popup' : null, stripeLink: null }))
    setRoute(routes.BUY_PROCESSING)
  }

  const handleBack = () => {
    // Card/Apple Pay is reached via the Add funds hub — back returns there.
    setRoute(routes.DEPOSIT)
  }

  // "Pay with card" — jump back to the method picker for a last-minute switch;
  // the entered amount survives in buyForm.
  const handleChangeMethod = () => {
    setRoute(routes.DEPOSIT)
  }
  const methodLabel = METHOD_LABEL[buyForm.method]

  const step1Disabled = fiatAmount === null || fiatAmount <= 0 || !session || !walletPayAngleKnown

  const feeText = quote ? currencyFormatter.format(totalFee(quote)) : null

  return (
    <PageContent onBack={handleBack}>
      {/* Token first: the heading carries the decided destination token and
          re-opens the token selector — everything below is amount + payment. */}
      <CenteredRow style={{ marginTop: 0 }}>
        <BuyHeadingButton type="button" onClick={handleOpenTokenSelector} title={tokenName}>
          <BuyHeadingLogo>
            <AssetChainLogo assetLogo={tokenLogo ?? ''} chainLogo={chainLogo ?? ''} symbol={tokenSymbol} />
          </BuyHeadingLogo>
          Buy {tokenSymbol || '—'}
          <Arrow width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ArrowChevron
              stroke="currentColor"
              d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Arrow>
        </BuyHeadingButton>
      </CenteredRow>

      <BigAmountRow>
        <BigAmountSymbol>{currencySymbol}</BigAmountSymbol>
        <BigAmountInput
          value={buyForm.amount}
          onChange={handleAmountChange}
          onBlur={handleAmountBlur}
          placeholder="0"
          inputMode="decimal"
          autoComplete="off"
          style={{ width: amountInputWidth(buyForm.amount) }}
        />
      </BigAmountRow>

      <CenteredRow>
        <div style={{ width: 120 }}>
          <LogoSelect
            value={buyForm.currency}
            onChange={(currency) => setBuyForm((prev) => ({ ...prev, currency, currencyPinned: true }))}
            options={SOURCE_CURRENCIES.map((c) => ({
              value: c,
              label: c,
              logo: null,
              icon: <FlagBadge aria-hidden>{CURRENCY_FLAG[c] ?? '💱'}</FlagBadge>,
            }))}
          />
        </div>
      </CenteredRow>

      {methodLabel && (
        <MethodRowButton type="button" onClick={handleChangeMethod}>
          Pay with {methodLabel}
          <Arrow width="11" height="10" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ArrowChevron
              stroke="currentColor"
              d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Arrow>
        </MethodRowButton>
      )}

      {feeText && (
        <SummarySection>
          <SummaryRow>
            <SummaryLabel>Fee</SummaryLabel>
            <SummaryLabel>{feeText}</SummaryLabel>
          </SummaryRow>
        </SummarySection>
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
