'use client'

import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { chevron, detailsToggle } from './formStyles.js'
import { OrDivider } from './OrDivider.js'

/**
 * Row that navigates to the standalone "Transfer from address" page (deposit
 * address + QR), instead of disclosing it inline beneath the current tab.
 */
export function AddressPageLink({ label }: { label: string }) {
  const { setRoute } = useOpenfort()
  return (
    <>
      <OrDivider />
      <button type="button" style={detailsToggle} onClick={() => setRoute(routes.DEPOSIT_CRYPTO)}>
        <span>{label}</span>
        <span style={chevron}>›</span>
      </button>
    </>
  )
}
