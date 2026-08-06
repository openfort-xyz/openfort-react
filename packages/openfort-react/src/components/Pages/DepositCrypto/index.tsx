'use client'

import { useEffect } from 'react'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos.js'
import { toDisplayMessage } from '../../../errors/base.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { DepositAddressBlock } from '../Deposit/DepositAddressBlock.js'
import { DepositProgress, isDepositFlowActive } from '../Deposit/DepositProgress.js'
import { RouteSelectors } from '../Deposit/RouteSelectors.js'
import { SameChainDepositStatus } from '../Deposit/SameChainDepositStatus.js'
import { SameChainDepositSuccess } from '../Deposit/SameChainDepositSuccess.js'
import { isSolana } from '../Deposit/sources.js'
import { TestnetNotice } from '../Deposit/TestnetNotice.js'
import { AccountChainNotice, UnsupportedNetworkNotice } from '../Deposit/UnsupportedNetworkNotice.js'
import { useDepositRoute } from '../Deposit/useDepositRoute.js'
import { useSameChainArrival } from '../Deposit/useSameChainArrival.js'
import { caipToChainId } from '../DepositWallet/walletDeeplinks.js'

/**
 * Transfer from address — choose a source chain + token and send to the deposit
 * address / QR that appears. Same-chain is a plain transfer to the wallet;
 * cross-chain routes bridge via Relay. Wallet deeplinks live on the separate
 * "Transfer from wallet" tab.
 */
const DepositCrypto = () => {
  const { triggerResize } = useOpenfort()
  const route = useDepositRoute()

  // biome-ignore lint/correctness/useExhaustiveDependencies: the route fields are re-measure triggers, not inputs — resolving an address and moving through the deposit states swaps in differently sized blocks
  useEffect(() => {
    triggerResize()
  }, [route.receiverAddress, route.loading, route.status, triggerResize])

  // Same-chain "transfer from address" lands in the wallet itself, so there's no
  // rail session — watch the native balance directly and swap to the success
  // screen once the deposit arrives.
  const sameChainEnabled = route.sameChain && !!route.receiverAddress && !isSolana(route.target.chain)
  const sameChainAddress = route.receiverAddress ?? ''
  const sameChainId = Number(route.target.chain.split(':')[1])
  const { arrived } = useSameChainArrival({
    address: sameChainAddress,
    chainId: sameChainId,
    enabled: sameChainEnabled,
  })

  if (isDepositFlowActive(route.status)) return <DepositProgress status={route.status} />
  if (sameChainEnabled && arrived) return <SameChainDepositSuccess address={sameChainAddress} chainId={sameChainId} />

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from address</ModalHeading>

      <TestnetNotice />

      {route.targetUnsupported ? (
        <UnsupportedNetworkNotice targetChain={route.target.chain} railChains={route.railChains} />
      ) : route.accountUnusableOnTarget ? (
        <AccountChainNotice targetChain={route.target.chain} />
      ) : (
        <>
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
            assetLogo={currencyLogoUrl(route.activeCurrency?.symbol, route.activeCurrency?.logo)}
            chainLogo={chainLogoUrl(caipToChainId(route.activeChain?.id), route.activeChain?.logo)}
            receiverAddress={route.receiverAddress}
            pm={route.pm}
            sourceCurrency={
              route.activeCurrency
                ? { symbol: route.activeCurrency.symbol, decimals: route.activeCurrency.decimals }
                : null
            }
            sameChain={route.sameChain}
            loading={route.loading}
            status={route.status}
          />
          {sameChainEnabled && <SameChainDepositStatus />}
          {route.error && (
            <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{toDisplayMessage(route.error)}</ModalBody>
          )}
        </>
      )}
    </PageContent>
  )
}

export default DepositCrypto
