'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { type ReactNode, type SyntheticEvent, useEffect } from 'react'
import { BankIcon, BuyIcon, ExternalLinkIcon, ReceiveIcon, WalletIcon } from '../../../assets/icons'
import logos from '../../../assets/logos'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains'
import { useFundingTarget } from '../../../hooks/openfort/useFundingTarget'
import { useResolvedFundingMethods } from '../../../hooks/openfort/useResolvedFundingMethods'
import useIsMobile from '../../../hooks/useIsMobile'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { ModalHeading } from '../../Common/Modal/styles'
import PoweredByFooter from '../../Common/PoweredByFooter'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { evmBuyCurrencies } from '../Buy/evmCurrencies'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies'
import { canPresentApplePay, type DepositMethodTarget, getPaymentOptions } from './paymentOptions'
import {
  DepositContent,
  LogoCluster,
  OptionButton,
  OptionIconBadge,
  OptionInfo,
  OptionLeft,
  OptionList,
  OptionSubtitle,
  OptionTitle,
} from './styles'

/**
 * The icon in each row's left badge (icons default to 20×20). Fiat rows carry
 * their brand mark HERE — no logo previews on the right for the cash rails.
 */
const METHOD_ICON: Record<FundingMethod, ReactNode> = {
  [FundingMethod.APPLE_PAY]: <logos.Apple />,
  [FundingMethod.GOOGLE_PAY]: <logos.Google />,
  [FundingMethod.CARD]: <BuyIcon />,
  [FundingMethod.BANK_TRANSFER]: <BankIcon />,
  [FundingMethod.WALLET]: <WalletIcon />,
  [FundingMethod.ADDRESS]: <ReceiveIcon />,
  [FundingMethod.EXCHANGE]: <ExternalLinkIcon />,
}

/** Brand logos previewed on the right of the CRYPTO rows (vendored SVGs, no external URLs). */
const BRAND_LOGOS: Partial<Record<FundingMethod, ReactNode[]>> = {
  [FundingMethod.WALLET]: [
    <logos.MetaMask key="mm" background />,
    <logos.Phantom key="ph" background />,
    <logos.Coinbase key="cb" background />,
    <logos.Trust key="tw" />,
    <logos.Rainbow key="rb" round />,
  ],
  [FundingMethod.EXCHANGE]: [<logos.Coinbase key="cb" background />, <logos.Binance key="bn" />],
}

const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Deposit hub — one entry point, a method selector. Each row shows an action
 * icon on the left and the tokens/wallets/exchanges it covers on the right.
 * Crypto/CEX route into the funding-session Pages; fiat rows reuse the Buy flow.
 */
const Deposit = () => {
  const { setRoute, setBuyForm, uiConfig, triggerResize } = useOpenfort()
  const { chainType } = useOpenfortCore()
  const isMobile = useIsMobile()
  const { isAvailable } = useFunding()
  const { chains } = useFundingChains()
  const { loaded, availableMethodIds } = useResolvedFundingMethods()
  const fundingTarget = useFundingTarget()

  // Wallet pay is device/browser gated, independent of region. Apple Pay has a
  // real capability API (ApplePaySession — Safari on macOS/iOS, so desktop Safari
  // shows the row too). Google Pay's isReadyToPay needs Google's script; until
  // that's wired, Android is the honest approximation.
  const options = getPaymentOptions({
    isMobile,
    fundingAvailable: isAvailable,
    canApplePay: canPresentApplePay(),
    canGooglePay: typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent),
    methods: uiConfig.funding?.methods,
  })

  // Fiat rows render ONLY once Openfort has resolved them for the buyer's
  // region + destination — a row must always be executable when tapped. Until
  // the resolve settles (and whenever it fails or returns nothing), the crypto
  // rails stand alone; there is deliberately NO static fiat fallback: showing a
  // method the region doesn't support is a compliance bug, not a UX nicety.
  // Crypto rows are NOT chain-gated here — each rail page runs its own
  // supported-network check when opened.
  const visibleOptions = options.filter(
    (o) => o.target.kind !== 'buy' || (loaded && availableMethodIds.has(backendMethodId(o.id) ?? ''))
  )

  // Fiat rows appearing changes the modal height; it only re-measures on an
  // explicit resize, so nudge it when the resolve settles.
  useEffect(() => {
    triggerResize()
  }, [loaded, triggerResize])

  // Distinct source-currency logos (USDC, USDT, ETH, …) for the "from address" row.
  const currencyLogos: string[] = []
  const seenSymbols = new Set<string>()
  for (const c of chains) {
    for (const cur of c.currencies) {
      if (cur.logo && !seenSymbols.has(cur.symbol)) {
        seenSymbols.add(cur.symbol)
        currencyLogos.push(cur.logo)
      }
    }
  }

  // Keep the preview compact: at most 4 logos (fewer on mobile).
  const maxLogos = isMobile ? 3 : 4

  /** The logos to preview on the right of a row. */
  const clusterFor = (id: FundingMethod): ReactNode[] => {
    if (id === FundingMethod.ADDRESS) {
      return currencyLogos.slice(0, maxLogos).map((src) => <img key={src} src={src} alt="" onError={hideBrokenLogo} />)
    }
    return (BRAND_LOGOS[id] ?? []).slice(0, maxLogos)
  }

  const go = (target: DepositMethodTarget) => {
    if (target.kind === 'crypto') {
      setRoute(routes.DEPOSIT_CRYPTO)
      return
    }
    if (target.kind === 'wallet') {
      setRoute(routes.DEPOSIT_WALLET)
      return
    }
    if (target.kind === 'cex') {
      setRoute(routes.DEPOSIT_CEX)
      return
    }
    // Fiat rails go through the Buy flow, which mints a funding session and
    // commits `{ type: 'onramp', method }` — the provider is resolved
    // server-side and never shown to the user.
    setBuyForm((prev) => ({
      ...prev,
      method: target.method,
      session: null,
      // Default the card-buy to USDC per chain family. Without this the EVM default
      // resolves to the wallet's (often empty) asset list — "no supported tokens" —
      // and the Solana native default would resolve to SOL (isSameToken treats any
      // two natives as equal).
      asset: chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES[0] : evmBuyCurrencies(fundingTarget.chain)[0],
    }))
    setRoute(routes.BUY)
  }

  return (
    <PageContent onBack={routes.CONNECTED}>
      <ModalHeading>Add funds</ModalHeading>
      <DepositContent>
        <OptionList>
          {visibleOptions.map((option) => (
            <OptionButton key={option.id} type="button" disabled={option.disabled} onClick={() => go(option.target)}>
              <OptionLeft>
                <OptionIconBadge>{METHOD_ICON[option.id]}</OptionIconBadge>
                <OptionInfo>
                  <OptionTitle>{option.title}</OptionTitle>
                  <OptionSubtitle>{option.disabledReason ?? option.subtitle}</OptionSubtitle>
                </OptionInfo>
              </OptionLeft>
              {option.target.kind !== 'buy' && <LogoCluster>{clusterFor(option.id)}</LogoCluster>}
            </OptionButton>
          ))}
        </OptionList>
      </DepositContent>
      <PoweredByFooter />
    </PageContent>
  )
}

export default Deposit
