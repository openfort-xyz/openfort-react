'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import logos from '../../../assets/logos'
import useIsMobile from '../../../hooks/useIsMobile'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AddressPageLink } from '../Deposit/AddressPageLink'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress'
import { walletListBtn } from '../Deposit/formStyles'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { ButtonLogo, Skeleton, StepDivider } from '../Deposit/styles'
import { useDepositRoute } from '../Deposit/useDepositRoute'
import { DepositWalletDesktop } from './DepositWalletDesktop'
import { buildWalletSendLinks } from './walletSendLinks'

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
 * Transfer from wallet — leads with prefilled deeplinks into the user's source
 * wallet app (the route is picked above). The manual deposit-address / QR path
 * is tucked behind an off-by-default toggle.
 */
const DepositWallet = () => {
  const { triggerResize } = useOpenfort()
  const isMobile = useIsMobile()
  const route = useDepositRoute('crypto')
  // Backend leaves pm.deeplinks empty in the MVP; synthesise them client-side
  // from the session's prefilled address URI. Prefer backend links if present.
  const deeplinks = route.pm?.deeplinks?.length
    ? route.pm.deeplinks
    : buildWalletSendLinks(route.pm?.addressUri, route.activeChain?.vmType ?? 'evm')

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

      <StepDivider>{isMobile ? 'Then open your wallet' : 'Then send from your wallet'}</StepDivider>

      {isMobile ? (
        <>
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
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...walletListBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
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
        />
      )}

      <AddressPageLink label="Or send to a deposit address" />

      {route.error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{route.error.message}</ModalBody>}
    </PageContent>
  )
}

export default DepositWallet
