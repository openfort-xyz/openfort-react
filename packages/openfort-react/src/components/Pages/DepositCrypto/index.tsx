'use client'

import { useEffect } from 'react'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { DepositAddressBlock } from '../Deposit/DepositAddressBlock'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress'
import { RouteSelectors } from '../Deposit/RouteSelectors'
import { useDepositRoute } from '../Deposit/useDepositRoute'

/**
 * Transfer from address — choose a source chain + token and send to the deposit
 * address / QR that appears. Same-chain is a plain transfer to the wallet;
 * cross-chain routes bridge via Relay. Wallet deeplinks live on the separate
 * "Transfer from wallet" tab.
 */
const DepositCrypto = () => {
  const { triggerResize } = useOpenfort()
  const route = useDepositRoute('crypto')

  useEffect(() => {
    triggerResize()
  }, [route.receiverAddress, route.loading, route.status, triggerResize])

  if (isDepositFlowActive(route.status)) return <DepositProgress status={route.status} />

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from address</ModalHeading>

      <RouteSelectors
        chains={route.chains}
        chain={route.chain}
        currency={route.currency}
        chainLabel="Supported chain"
        onChainChange={route.setChain}
        onCurrencyChange={route.setCurrency}
      />

      {!route.isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}
      <DepositAddressBlock
        assetLogo={route.activeCurrency?.logo ?? null}
        chainLogo={route.activeChain?.logo ?? null}
        receiverAddress={route.receiverAddress}
        pm={route.pm}
        sourceCurrency={
          route.activeCurrency ? { symbol: route.activeCurrency.symbol, decimals: route.activeCurrency.decimals } : null
        }
        sameChain={route.sameChain}
        loading={route.loading}
        status={route.status}
      />
      {route.error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{route.error.message}</ModalBody>}
    </PageContent>
  )
}

export default DepositCrypto
