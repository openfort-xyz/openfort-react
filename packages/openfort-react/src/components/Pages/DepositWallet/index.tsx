'use client'

import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import logos from '../../../assets/logos.js'
import { toDisplayMessage } from '../../../errors/base.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import { isSolana } from '../../../hooks/openfort/fundingSources.js'
import useIsMobile from '../../../hooks/useIsMobile.js'
import styled from '../../../styles/styled/index.js'
import { isIOS } from '../../../utils/index.js'
import { isHttpsUrl } from '../../../utils/urlSecurity.js'
import { Arrow, ArrowChevron } from '../../Common/Button/styles.js'
import {
  ConnectorButton,
  ConnectorIcon,
  ConnectorLabel,
  ConnectorsContainer,
} from '../../Common/ConnectorList/styles.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { ScrollArea } from '../../Common/ScrollArea/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { BigAmountInput, BigAmountRow, BigAmountSymbol, MethodRowButton } from '../Buy/styles.js'
import { amountInputWidth } from '../Buy/utils.js'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress.js'
import { RouteSelectors } from '../Deposit/RouteSelectors.js'
import { Skeleton, StepDivider } from '../Deposit/styles.js'
import { TestnetNotice } from '../Deposit/TestnetNotice.js'
import { AccountChainNotice, UnsupportedNetworkNotice } from '../Deposit/UnsupportedNetworkNotice.js'
import { useDepositRoute } from '../Deposit/useDepositRoute.js'
import { sanitizeAmountInput } from '../Send/utils.js'
import { DepositWalletDesktop } from './DepositWalletDesktop.js'
import {
  buildDepositPageUrl,
  buildOpenDappLinks,
  caipToChainId,
  OPENFORT_DEPOSIT_PAGE_URL,
  type VmType,
} from './walletDeeplinks.js'

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

/**
 * Transfer from wallet. Pick a source chain/token and an amount, then choose the
 * wallet to send from. On mobile that's open-dApp deeplinks into the wallet app's
 * in-app browser (address/chain/token/amount prefilled); on desktop it's a direct
 * send from a browser-extension wallet. The manual deposit-address / QR path stays
 * available below.
 */
const DepositWallet = () => {
  const { triggerResize, uiConfig, setRoute } = useOpenfort()
  const isMobile = useIsMobile()
  const route = useDepositRoute()
  // The desktop send path goes through the wagmi bridge (browser-extension wallets).
  // In Solana-only mode there's no wagmi provider, so fall back to the open-dApp
  // deeplinks for EVM sources too — otherwise the wallet list renders empty.
  const bridge = useEthereumBridge()
  // Prefill a sensible default so the wallet deeplinks are immediately actionable
  // (the funding deposit-address mint uses a fixed nominal amount regardless).
  const [amount, setAmount] = useState('1')

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
      setAmount(raw)
    }
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

  // The funding service supplies these, and they are the one funding link that
  // does not go through `getTrustedFundingProviderUrl` — the destinations are
  // third-party wallet domains, so an origin allowlist cannot cover them. An
  // https-only check still rules out `javascript:` and `data:`.
  const serverDeeplinks = (route.pm?.deeplinks ?? []).filter((deeplink) => isHttpsUrl(deeplink.url))
  const allDeeplinks = serverDeeplinks.length
    ? serverDeeplinks
    : pageUrl
      ? buildOpenDappLinks(pageUrl, (route.activeChain?.vmType as VmType) ?? 'evm')
      : []
  // Trust's in-app dApp browser was removed on iOS (Apple, 2021) — the link
  // dead-ends there, so hide it on iOS while keeping it on Android.
  const deeplinks = isIOS() ? allDeeplinks.filter((d) => d.app !== 'trust') : allDeeplinks

  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers, not inputs — the deposit state and the wallet count each change the page height
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

            <BigAmountRow>
              <BigAmountInput
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                inputMode="decimal"
                autoComplete="off"
                style={{ width: amountInputWidth(amount) }}
              />
              <BigAmountSymbol>{route.activeCurrency?.symbol ?? ''}</BigAmountSymbol>
            </BigAmountRow>

            <MethodRowButton type="button" onClick={() => setRoute(routes.DEPOSIT)}>
              Other payment methods
              <Arrow width="11" height="10" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ArrowChevron
                  stroke="currentColor"
                  d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Arrow>
            </MethodRowButton>

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
                  <ScrollArea mobileDirection={'horizontal'}>
                    <ConnectorsContainer $mobile $totalResults={deeplinks.length} $disabled={!amountValid}>
                      {deeplinks.map((d) => (
                        <ConnectorButton
                          as="a"
                          key={d.app}
                          href={amountValid ? d.url : undefined}
                          aria-disabled={!amountValid}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ConnectorIcon data-shape="squircle">
                            {WALLET_LOGO[d.app] ?? <logos.Injected />}
                          </ConnectorIcon>
                          {/* Deeplink labels read "Open <wallet>" — the tile icon already says it. */}
                          <ConnectorLabel>{d.label.replace(/^Open\s+/, '')}</ConnectorLabel>
                        </ConnectorButton>
                      ))}
                    </ConnectorsContainer>
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
            {route.error && (
              <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{toDisplayMessage(route.error)}</ModalBody>
            )}
          </FixedFooter>
        </Layout>
      )}
    </PageContent>
  )
}

export default DepositWallet
