'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect } from 'react'
import { getExplorerUrl } from '../../../shared/utils/explorer.js'
import Button from '../../Common/Button/index.js'
import Loader from '../../Common/Loading/index.js'
import PoweredByFooter from '../../Common/PoweredByFooter/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

/**
 * Terminal success screen for a same-chain "transfer from address" deposit.
 * The deposit lands in the wallet itself (no rail session), so arrival is
 * detected by a native balance increase and we don't hold the inbound tx hash —
 * "View on Explorer" therefore opens the wallet's address page, where the
 * incoming transfer is listed.
 */
export function SameChainDepositSuccess({ address, chainId }: { address: string; chainId: number }) {
  const { setRoute, triggerResize } = useOpenfort()

  // Collapse the modal from the tall deposit form down to the compact card.
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  const explorerUrl = getExplorerUrl(ChainTypeEnum.EVM, { chainId, address })

  return (
    <PageContent>
      <Loader isSuccess header="Deposit received" description="Funds are in your wallet" />
      {explorerUrl && (
        <Button variant="primary" onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}>
          View on Explorer
        </Button>
      )}
      <Button variant="secondary" onClick={() => setRoute(routes.CONNECTED)}>
        Back to profile
      </Button>
      <PoweredByFooter />
    </PageContent>
  )
}
