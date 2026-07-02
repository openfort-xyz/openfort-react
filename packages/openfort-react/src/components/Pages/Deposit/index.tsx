'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { type ReactNode, type SyntheticEvent, useEffect } from 'react'
import { BankIcon, BuyIcon, DollarIcon, ExternalLinkIcon, ReceiveIcon, WalletIcon } from '../../../assets/icons'
import logos from '../../../assets/logos'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains'
import { useResolvedFundingMethods } from '../../../hooks/openfort/useResolvedFundingMethods'
import useIsMobile from '../../../hooks/useIsMobile'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { ModalHeading } from '../../Common/Modal/styles'
import PoweredByFooter from '../../Common/PoweredByFooter'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { EVM_BUY_CURRENCIES } from '../Buy/evmCurrencies'
import { backendMethodId } from '../Buy/onrampMethodsApi'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies'
import { type DepositMethodTarget, getPaymentOptions } from './paymentOptions'
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
import { UnsupportedNetworkNotice } from './UnsupportedNetworkNotice'
import { useFundingTarget } from './useFundingTarget'

/** The action icon shown in each row's left badge (icons default to 20×20). */
const METHOD_ICON: Record<FundingMethod, ReactNode> = {
  [FundingMethod.APPLE_PAY]: <DollarIcon />,
  [FundingMethod.GOOGLE_PAY]: <DollarIcon />,
  [FundingMethod.CARD]: <BuyIcon />,
  [FundingMethod.BANK_TRANSFER]: <BankIcon />,
  [FundingMethod.WALLET]: <WalletIcon />,
  [FundingMethod.ADDRESS]: <ReceiveIcon />,
  [FundingMethod.EXCHANGE]: <ExternalLinkIcon />,
}

/** Brand logos previewed on the right of each row (vendored SVGs, no external URLs). */
const BRAND_LOGOS: Partial<Record<FundingMethod, ReactNode[]>> = {
  [FundingMethod.WALLET]: [
    <logos.MetaMask key="mm" background />,
    <logos.Phantom key="ph" background />,
    <logos.Coinbase key="cb" background />,
    <logos.Trust key="tw" />,
    <logos.Rainbow key="rb" round />,
  ],
  [FundingMethod.EXCHANGE]: [<logos.Coinbase key="cb" background />, <logos.Binance key="bn" />],
  [FundingMethod.CARD]: [<logos.Visa key="visa" />, <logos.Mastercard key="mc" />],
  [FundingMethod.APPLE_PAY]: [<logos.Apple key="apple" />],
  [FundingMethod.GOOGLE_PAY]: [<logos.Google key="google" />],
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
  const { chains, railChains, loading: chainsLoading } = useFundingChains()
  const target = useFundingTarget()
  const { loaded, availableMethodIds, providerFor } = useResolvedFundingMethods()

  // The rail can only deliver to chains it lists. If the embedded wallet's target
  // chain (e.g. Polygon Amoy or a Solana testnet) isn't one of them, there's no
  // deposit route at all — show the explanation instead of any method options.
  const targetUnsupported = !chainsLoading && railChains.length > 0 && !railChains.some((c) => c.id === target.chain)

  // Content swaps between the option list and the notice once chains resolve; the
  // modal only re-measures on an explicit resize, so nudge it when that flips.
  useEffect(() => {
    triggerResize()
  }, [targetUnsupported, triggerResize])

  // Wallet pay is browser/device gated: Apple Pay on Apple/Safari, Google Pay on
  // Android/Chrome. UA heuristic for now — TODO: refine with ApplePaySession /
  // Google Pay isReadyToPay capability checks.
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const isApple = /Mac|iPhone|iPad|iPod/.test(ua)
  const options = getPaymentOptions({
    isMobile,
    fundingAvailable: isAvailable,
    canApplePay: isApple,
    canGooglePay: !isApple,
    methods: uiConfig.funding?.methods,
  })

  // Fiat rows render ONLY once Openfort has resolved them for the buyer's
  // region + destination — a row must always be executable when tapped. Until
  // the resolve settles (and whenever it fails or returns nothing), the crypto
  // rails stand alone; there is deliberately NO static fiat fallback: showing a
  // method the region doesn't support is a compliance bug, not a UX nicety.
  const visibleOptions = options.filter(
    (o) => o.target.kind !== 'buy' || (loaded && availableMethodIds.has(backendMethodId(o.id) ?? ''))
  )

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
    // Fiat rails reuse the Buy flow. The provider is resolved by Openfort
    // (region + destination asset) and never shown to the user. A row without a
    // resolved provider can't render (visibleOptions gates on the resolve), so
    // this only guards a race between resolve state and a just-tapped row.
    const providerId = providerFor(target.method)
    if (!providerId) {
      return
    }
    setBuyForm((prev) => ({
      ...prev,
      providerId,
      // Default the card-buy to USDC per chain family. Without this the EVM default
      // resolves to the wallet's (often empty) asset list — "no supported tokens" —
      // and the Solana native default would resolve to SOL (isSameToken treats any
      // two natives as equal).
      asset: chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES[0] : EVM_BUY_CURRENCIES[0],
    }))
    setRoute(routes.BUY)
  }

  return (
    <PageContent onBack={routes.CONNECTED}>
      <ModalHeading>Add funds</ModalHeading>
      {targetUnsupported ? (
        <UnsupportedNetworkNotice targetChain={target.chain} railChains={railChains} />
      ) : (
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
                <LogoCluster>{clusterFor(option.id)}</LogoCluster>
              </OptionButton>
            ))}
          </OptionList>
        </DepositContent>
      )}
      <PoweredByFooter />
    </PageContent>
  )
}

export default Deposit
