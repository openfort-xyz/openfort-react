'use client'

import { useEffect } from 'react'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AddressToggle } from '../Deposit/AddressToggle'
import { DepositAddressBlock } from '../Deposit/DepositAddressBlock'
import { walletListBtn } from '../Deposit/formStyles'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { useDepositRoute } from '../Deposit/useDepositRoute'

/**
 * Transfer from wallet — leads with prefilled deeplinks into the user's source
 * wallet app (the route is picked above). The manual deposit-address / QR path
 * is tucked behind an off-by-default toggle.
 */
const DepositWallet = () => {
  const { triggerResize } = useOpenfort()
  const route = useDepositRoute('crypto')
  const deeplinks = route.pm?.deeplinks ?? []

  useEffect(() => {
    triggerResize()
  }, [route.receiverAddress, route.loading, deeplinks.length, triggerResize])

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

      {!route.isAvailable && <ModalBody>Set uiConfig.fundingBaseUrl to enable transfers.</ModalBody>}
      {route.loading && !route.pm && <ModalBody style={{ marginTop: 12 }}>Preparing wallet links…</ModalBody>}

      {deeplinks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {deeplinks.map((d) => (
            <a key={d.app} href={d.url} target="_blank" rel="noreferrer" style={walletListBtn}>
              {d.label} ↗
            </a>
          ))}
        </div>
      )}
      {route.isAvailable && !route.loading && route.sameChain && (
        <ModalBody style={{ marginTop: 12 }}>Pick a different source chain to get wallet links.</ModalBody>
      )}

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

export default DepositWallet
