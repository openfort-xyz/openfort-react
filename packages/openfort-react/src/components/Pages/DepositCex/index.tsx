'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import logos from '../../../assets/logos'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AddressToggle } from '../Deposit/AddressToggle'
import { DepositAddressBlock } from '../Deposit/DepositAddressBlock'
import { deeplinkBtn, deeplinkRow } from '../Deposit/formStyles'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { ButtonLogo } from '../Deposit/styles'
import { useDepositRoute } from '../Deposit/useDepositRoute'

const PAY_EXCHANGES = ['coinbase', 'binance'] as const

/** Exchange brand logos keyed by exchange id. */
const EXCHANGE_LOGO: Record<string, ReactNode> = {
  coinbase: <logos.Coinbase background />,
  binance: <logos.Binance />,
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Transfer from Exchange — leads with one-tap Coinbase Pay / Binance Pay. The
 * manual deposit-address / QR path (withdraw from any exchange) sits behind an
 * off-by-default toggle.
 */
const DepositCex = () => {
  const { triggerResize } = useOpenfort()
  const route = useDepositRoute('cex')

  useEffect(() => {
    triggerResize()
  }, [route.receiverAddress, route.loading, triggerResize])

  const openPay = (exchange: string) => {
    if (!route.address) return
    const w = window.open('about:blank', '_blank', 'noopener,noreferrer')
    void route
      .payLink({ exchange, address: route.address, asset: route.currency, chain: route.target.chain, amount: '10' })
      .then((url) => {
        if (w) w.location.href = url
      })
      .catch(() => w?.close())
  }

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from Exchange</ModalHeading>

      <RouteSelectors
        chains={route.chains}
        chain={route.chain}
        currency={route.currency}
        chainLabel="Network"
        onChainChange={route.setChain}
        onCurrencyChange={route.setCurrency}
      />

      {!route.isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}

      <div style={deeplinkRow}>
        {PAY_EXCHANGES.map((ex) => (
          <button
            key={ex}
            type="button"
            style={{ ...deeplinkBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => openPay(ex)}
          >
            <ButtonLogo>{EXCHANGE_LOGO[ex]}</ButtonLogo>
            Open {titleCase(ex)} ↗
          </button>
        ))}
      </div>

      <AddressToggle label="Or send to a deposit address">
        <DepositAddressBlock
          assetLogo={route.activeCurrency?.logo ?? null}
          chainLogo={route.activeChain?.logo ?? null}
          receiverAddress={route.receiverAddress}
          pm={route.pm}
          sameChain={route.sameChain}
          loading={route.loading}
        />
      </AddressToggle>

      {route.error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{route.error.message}</ModalBody>}
    </PageContent>
  )
}

export default DepositCex
