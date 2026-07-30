'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { type ReactNode, type SyntheticEvent, useEffect } from 'react'
import { BuyIcon, DollarIcon, ExternalLinkIcon, ReceiveIcon, WalletIcon } from '../../../assets/icons.js'
import logos from '../../../assets/logos.js'
import { useFunding } from '../../../hooks/openfort/useFunding.js'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains.js'
import useIsMobile from '../../../hooks/useIsMobile.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import PoweredByFooter from '../../Common/PoweredByFooter/index.js'
import { FundingMethod, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { EVM_BUY_CURRENCIES } from '../Buy/evmCurrencies.js'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies.js'
import { type DepositMethodTarget, getPaymentOptions } from './paymentOptions.js'
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
} from './styles.js'
import { UnsupportedNetworkNotice } from './UnsupportedNetworkNotice.js'
import { useFundingTarget } from './useFundingTarget.js'

/** The action icon shown in each row's left badge (icons default to 20×20). */
const METHOD_ICON: Record<FundingMethod, ReactNode> = {
  [FundingMethod.APPLE_PAY]: <DollarIcon />,
  [FundingMethod.CARD]: <BuyIcon />,
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
  const chainType = useOpenfortCore((s) => s.chainType)
  const isMobile = useIsMobile()
  const { isAvailable } = useFunding()
  const { chains, railChains, isLoading: chainsLoading } = useFundingChains()
  const target = useFundingTarget()

  // The rail can only deliver to chains it lists. If the embedded wallet's target
  // chain (e.g. Polygon Amoy or a Solana testnet) isn't one of them, there's no
  // deposit route at all — show the explanation instead of any method options.
  const targetUnsupported = !chainsLoading && railChains.length > 0 && !railChains.some((c) => c.id === target.chain)

  // Content swaps between the option list and the notice once chains resolve; the
  // modal only re-measures on an explicit resize, so nudge it when that flips.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `targetUnsupported` is the trigger, not an input
  useEffect(() => {
    triggerResize()
  }, [targetUnsupported, triggerResize])

  const options = getPaymentOptions({
    isMobile,
    fundingAvailable: isAvailable,
    methods: uiConfig.funding?.methods,
  })

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
    // Fiat rails reuse the existing Buy flow; preselect the chosen provider so
    // Apple Pay / Card land on the right rail.
    setBuyForm((prev) => ({
      ...prev,
      providerId: target.providerId,
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
            {options.map((option) => (
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
