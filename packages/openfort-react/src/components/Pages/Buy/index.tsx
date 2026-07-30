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
import { isWalletPayMethod, needsWalletPayCapture } from '../../../hooks/openfort/walletPay'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import Checkbox from '../../Common/Checkbox'
import { ModalBody } from '../../Common/Modal/styles'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import { getAssetSymbol, isSameToken, sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'
import { EVM_BUY_CURRENCIES } from './evmCurrencies'
import { SOLANA_BUY_CURRENCIES } from './solanaCurrencies'
import {
  BigAmountInput,
  BigAmountRow,
  BigAmountSymbol,
  BuyHeadingButton,
  BuyHeadingLogo,
  CenteredRow,
  ContinueButtonWrapper,
  CurrencyPill,
  CurrencySelect,
  FlagBadge,
  MethodRowButton,
  SummaryLabel,
  SummaryMuted,
  SummaryRow,
  SummarySection,
} from './styles'
import { createCurrencyFormatter, getCurrencySymbol } from './utils'

// Fiat source currencies the onramp accepts. Kept small; USD is the safe default
// (some providers reject non-USD and fall back to the buyer's local currency).
const SOURCE_CURRENCIES = ['USD', 'EUR', 'GBP']

// Flag shown in the currency pill (display only — the selector drives the value).
const CURRENCY_FLAG: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
}

// The payment-method switch below the amount ("Pay with card") — plain grey
// text back to the method picker, not a required step.
const METHOD_LABEL: Partial<Record<FundingMethod, string>> = {
  [FundingMethod.APPLE_PAY]: 'Apple Pay',
  [FundingMethod.GOOGLE_PAY]: 'Google Pay',
  [FundingMethod.CARD]: 'card',
  [FundingMethod.BANK_TRANSFER]: 'bank transfer',
}

// Coinbase Guest-Checkout requires the buyer to accept these before a native
// wallet-pay order. TODO: confirm the exact required wording/links against
// Coinbase's Guest Checkout integration terms before go-live.
const COINBASE_TERMS_URL = 'https://www.coinbase.com/legal/user_agreement'
const COINBASE_PRIVACY_URL = 'https://www.coinbase.com/legal/privacy'

const Buy = () => {
  const { buyForm, setBuyForm, setRoute, triggerResize } = useOpenfort()
  const { chainType } = useOpenfortCore()
  const { user } = useUser()

  // Apple/Google Pay MAY commit a Coinbase NATIVE order (US buyer + project
  // CDP creds) — then the buyer must accept Coinbase's Guest-Checkout terms
  // here (we stamp agreementAcceptedAt) and verify email + phone before the
  // commit. Everywhere else the server resolves them to an embedded or hosted
  // checkout, which needs neither; the resolved angle decides.
  const isWalletPay = isWalletPayMethod(buyForm.method)
  const [consented, setConsented] = useState(false)
  // The selectable BUY list per chain family — the same list the token selector
  // shows, so a picked token always matches (the wallet's indexed assets are
  // irrelevant when buying).
  const buyList = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : EVM_BUY_CURRENCIES

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

  const defaultTarget = useFundingTarget()
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

  // Whether THIS buyer's wallet-pay resolves to the native sheet or an
  // embedded/hosted checkout — server-decided per region + project creds. Until
  // the resolve lands (or when the row is missing) we assume native, the safe
  // direction: identity capture is never skipped when the commit requires it.
  const fundingMethods = useFundingMethods(isWalletPay ? session : null, { useBackendUrl: true })
  const methodId = backendMethodId(buyForm.method)
  const resolvedRow = fundingMethods.methods.find((m) => m.method === methodId)
  // Hold Continue only while the resolve is in flight; once settled, a missing
  // row (resolve failed / older backend) keeps the native assumption.
  const walletPayAngleKnown = !isWalletPay || fundingMethods.loaded
  const isNativeWalletPay = isWalletPay && (resolvedRow ? resolvedRow.angle === 'native' : true)

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
    method: backendMethodId(buyForm.method),
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
    // Card, bank transfer, and embedded/hosted wallet pay commit directly — the
    // server resolves the provider (never shown to the user) and the checkout
    // collects its own consent, so no identity capture here.
    setBuyForm((prev) => ({ ...prev, session, walletPayAngle: isWalletPay ? 'iframe' : null }))
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

  const step1Disabled =
    fiatAmount === null || fiatAmount <= 0 || !session || !walletPayAngleKnown || (isNativeWalletPay && !consented)

  const feeText = quote ? currencyFormatter.format(totalFee(quote)) : null

  // The amount input hugs its value so the symbol stays attached ($|50|).
  const amountWidthCh = Math.min(Math.max(buyForm.amount.length, 1), 12)

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
          style={{ width: `${amountWidthCh}ch` }}
        />
      </BigAmountRow>

      <CenteredRow>
        <CurrencyPill>
          <FlagBadge aria-hidden>{CURRENCY_FLAG[buyForm.currency] ?? '💱'}</FlagBadge>
          <CurrencySelect value={buyForm.currency} onChange={handleCurrencyChange}>
            {SOURCE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </CurrencySelect>
          <Arrow width="11" height="10" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ArrowChevron
              stroke="currentColor"
              d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Arrow>
        </CurrencyPill>
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
            <SummaryMuted>{feeText}</SummaryMuted>
          </SummaryRow>
        </SummarySection>
      )}

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
