'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import logos from '../../../assets/logos'
import useIsMobile from '../../../hooks/useIsMobile'
import { isIOS } from '../../../utils'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AmountCard, AmountInput, CurrencySymbol, PresetButton, PresetList, Section, SectionLabel } from '../Buy/styles'
import { AddressPageLink } from '../Deposit/AddressPageLink'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress'
import { walletListBtn } from '../Deposit/formStyles'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { ButtonLogo, Skeleton, StepDivider } from '../Deposit/styles'
import { useDepositRoute } from '../Deposit/useDepositRoute'
import { sanitizeAmountInput } from '../Send/utils'
import { DepositWalletDesktop } from './DepositWalletDesktop'
import {
  buildDepositPageUrl,
  buildOpenDappLinks,
  caipToChainId,
  OPENFORT_DEPOSIT_PAGE_URL,
  type VmType,
} from './walletDeeplinks'

/** Wallet-app brand logos keyed by the deeplink `app` id. */
const WALLET_LOGO: Record<string, ReactNode> = {
  metamask: <logos.MetaMask background />,
  coinbase: <logos.Coinbase background />,
  phantom: <logos.Phantom background />,
  trust: <logos.Trust />,
  rainbow: <logos.Rainbow round />,
  rabby: <logos.Rabby />,
}

/** Preset deposit amounts, in the selected source token's units. */
const PRESETS = [10, 25, 50]

/**
 * Transfer from wallet. Pick a source chain/token and an amount, then choose the
 * wallet to send from. On mobile that's open-dApp deeplinks into the wallet app's
 * in-app browser (address/chain/token/amount prefilled); on desktop it's a direct
 * send from a browser-extension wallet. The manual deposit-address / QR path stays
 * available below.
 */
const DepositWallet = () => {
  const { triggerResize, uiConfig } = useOpenfort()
  const isMobile = useIsMobile()
  const route = useDepositRoute('crypto')
  const [amount, setAmount] = useState('')
  const [pressedPreset, setPressedPreset] = useState<number | null>(null)

  const depositPageUrl = uiConfig.funding?.depositPageUrl ?? OPENFORT_DEPOSIT_PAGE_URL
  const srcChainId = caipToChainId(route.activeChain?.id)
  const amountValid = Number.parseFloat(amount) > 0

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setPressedPreset(null)
      setAmount(raw)
    }
  }

  const handlePreset = (value: number) => {
    setPressedPreset(value)
    setAmount(String(value))
  }

  // Open-dApp deeplinks: prefer backend-provided ones; otherwise build them from
  // the hosted deposit page URL (if the integrator configured one) carrying the
  // resolved transfer params. The hosted page sends via the wallet's injected
  // provider, so no backend wiring is required for the link itself.
  const pageUrl =
    depositPageUrl && route.receiverAddress && route.activeCurrency && srcChainId
      ? buildDepositPageUrl(depositPageUrl, {
          to: route.receiverAddress,
          chainId: srcChainId,
          token: route.activeCurrency.native ? undefined : route.activeCurrency.address,
          decimals: route.activeCurrency.decimals,
          symbol: route.activeCurrency.symbol,
          chain: route.activeChain?.name,
          amount: amountValid ? parseUnits(amount, route.activeCurrency.decimals).toString() : undefined,
        })
      : null

  const allDeeplinks = route.pm?.deeplinks?.length
    ? route.pm.deeplinks
    : pageUrl
      ? buildOpenDappLinks(pageUrl, (route.activeChain?.vmType as VmType) ?? 'evm')
      : []
  // Trust's in-app dApp browser was removed on iOS (Apple, 2021) — the link
  // dead-ends there, so hide it on iOS while keeping it on Android.
  const deeplinks = isIOS() ? allDeeplinks.filter((d) => d.app !== 'trust') : allDeeplinks

  useEffect(() => {
    triggerResize()
  }, [route.receiverAddress, route.loading, route.status, deeplinks.length, triggerResize])

  if (isDepositFlowActive(route.status)) return <DepositProgress status={route.status} />

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from wallet</ModalHeading>

      <RouteSelectors
        chains={route.chains}
        chain={route.chain}
        currency={route.currency}
        chainLabel="Supported chain"
        onChainChange={route.setChain}
        onCurrencyChange={route.setCurrency}
      />

      {!route.isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}

      <Section>
        <SectionLabel>Amount</SectionLabel>
        <AmountCard>
          <CurrencySymbol>{route.activeCurrency?.symbol ?? ''}</CurrencySymbol>
          <AmountInput
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
          />
        </AmountCard>
        <PresetList>
          {PRESETS.map((preset) => (
            <PresetButton
              key={preset}
              type="button"
              $active={pressedPreset === preset}
              onClick={() => handlePreset(preset)}
            >
              {preset}
            </PresetButton>
          ))}
        </PresetList>
      </Section>

      <StepDivider>Then select the wallet you want to use</StepDivider>

      {isMobile ? (
        <>
          {!depositPageUrl && (
            <ModalBody style={{ marginTop: 12 }}>Use a deposit address below to fund from your wallet.</ModalBody>
          )}

          {route.loading && !route.pm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <Skeleton $h="44px" $r="10px" />
              <Skeleton $h="44px" $r="10px" />
              <Skeleton $h="44px" $r="10px" />
            </div>
          )}

          {deeplinks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {deeplinks.map((d) => (
                <a
                  key={d.app}
                  href={amountValid ? d.url : undefined}
                  aria-disabled={!amountValid}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...walletListBtn,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: amountValid ? 1 : 0.55,
                    pointerEvents: amountValid ? 'auto' : 'none',
                  }}
                >
                  {WALLET_LOGO[d.app] && <ButtonLogo>{WALLET_LOGO[d.app]}</ButtonLogo>}
                  {d.label} ↗
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <DepositWalletDesktop
          receiverAddress={route.receiverAddress}
          activeChain={route.activeChain}
          activeCurrency={route.activeCurrency}
          loading={route.loading}
          amount={amount}
        />
      )}

      <AddressPageLink label="Or send to a deposit address" />

      {route.error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{route.error.message}</ModalBody>}
    </PageContent>
  )
}

export default DepositWallet
