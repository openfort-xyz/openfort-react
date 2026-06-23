'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import logos from '../../../assets/logos'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import useIsMobile from '../../../hooks/useIsMobile'
import styled from '../../../styles/styled'
import { isIOS } from '../../../utils'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { ScrollArea } from '../../Common/ScrollArea'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AmountCard, AmountInput, CurrencySymbol, PresetButton, PresetList, Section, SectionLabel } from '../Buy/styles'
import { AddressPageLink } from '../Deposit/AddressPageLink'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress'
import { walletListBtn } from '../Deposit/formStyles'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { isSolana } from '../Deposit/sources'
import { ButtonLogo, Skeleton, StepDivider } from '../Deposit/styles'
import { TestnetNotice } from '../Deposit/TestnetNotice'
import { AccountChainNotice, UnsupportedNetworkNotice } from '../Deposit/UnsupportedNetworkNotice'
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

// Flex column capped at the modal viewport so the page never overflows
// InnerContainer (which caps at 88vh and would otherwise scroll the footer off
// screen). The 112px accounts for the chrome wrapping this element inside the
// measured PageContents: PageContentStyle's 48px top padding + PageContents'
// 29px/24px padding (~101px), plus a small safety margin. The providers region
// is the only part that shrinks/scrolls, which keeps the footer visible.
const Layout = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(88vh - 112px);
`

const TopFixed = styled.div`
  flex-shrink: 0;
`

// Grows to fill the space between the fixed top and footer; its ScrollArea
// scrolls internally when the wallet list is taller than the available room.
const ProvidersRegion = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 14px;
`

const FixedFooter = styled.div`
  flex-shrink: 0;
`

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
  // The desktop send path goes through the wagmi bridge (browser-extension wallets).
  // In Solana-only mode there's no wagmi provider, so fall back to the open-dApp
  // deeplinks for EVM sources too — otherwise the wallet list renders empty.
  const bridge = useEthereumBridge()
  // Prefill a sensible default so the wallet deeplinks are immediately actionable
  // (the funding deposit-address mint uses a fixed nominal amount regardless).
  const [amount, setAmount] = useState('1')
  const [pressedPreset, setPressedPreset] = useState<number | null>(null)

  const depositPageUrl = uiConfig.funding?.depositPageUrl ?? OPENFORT_DEPOSIT_PAGE_URL
  // Solana sources have no numeric chain id and no desktop EVM-extension send, so
  // they route through the deeplink (Phantom) on every platform instead of the
  // wagmi-bridge desktop path.
  const isSolanaSrc = isSolana(route.activeChain?.id ?? '')
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
    depositPageUrl && route.receiverAddress && route.activeCurrency && (isSolanaSrc || srcChainId)
      ? buildDepositPageUrl(depositPageUrl, {
          vm: isSolanaSrc ? 'svm' : 'evm',
          to: route.receiverAddress,
          chainId: isSolanaSrc ? undefined : srcChainId,
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

      <TestnetNotice />

      {route.targetUnsupported && (
        <UnsupportedNetworkNotice targetChain={route.target.chain} railChains={route.railChains} />
      )}

      {!route.targetUnsupported && route.accountUnusableOnTarget && (
        <AccountChainNotice targetChain={route.target.chain} />
      )}

      {!route.targetUnsupported && !route.accountUnusableOnTarget && (
        <Layout>
          <TopFixed>
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
          </TopFixed>

          <ProvidersRegion>
            {isMobile || isSolanaSrc || !bridge ? (
              <>
                {!depositPageUrl && (
                  <ModalBody style={{ marginTop: 12 }}>Use a deposit address below to fund from your wallet.</ModalBody>
                )}

                {route.loading && !route.pm && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton $h="44px" $r="10px" />
                    <Skeleton $h="44px" $r="10px" />
                    <Skeleton $h="44px" $r="10px" />
                  </div>
                )}

                {deeplinks.length > 0 && (
                  <ScrollArea fill>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  </ScrollArea>
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
          </ProvidersRegion>

          <FixedFooter>
            <AddressPageLink label="Or send to a deposit address" />

            {route.error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{route.error.message}</ModalBody>}
          </FixedFooter>
        </Layout>
      )}
    </PageContent>
  )
}

export default DepositWallet
