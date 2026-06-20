'use client'

import { useEffect } from 'react'
import Button from '../../Common/Button'
import Loader from '../../Common/Loading'
import PoweredByFooter from '../../Common/PoweredByFooter'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'

/**
 * Terminal success screen for a funding deposit. Replaces the deposit form once
 * Relay reports the funds delivered, collapsing the modal to the compact
 * confirmation size with a tick animation and a shortcut back to the balance.
 */
export function DepositSuccess() {
  const { setRoute, triggerResize } = useOpenfort()

  // Collapse the modal from the tall deposit form down to the compact card.
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  return (
    <PageContent>
      <Loader isSuccess header="Deposit received" description="Funds delivered to your wallet" />
      <Button variant="primary" onClick={() => setRoute(routes.ASSET_INVENTORY)}>
        See balance
      </Button>
      <PoweredByFooter />
    </PageContent>
  )
}
