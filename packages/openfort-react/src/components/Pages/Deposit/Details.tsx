'use client'

import { useEffect, useState } from 'react'
import type { PaymentMethod } from '../../../hooks/openfort/useFunding'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { chevron, detailsBox, detailsLabel, detailsRow, detailsToggle, detailsValue } from './formStyles'
import { formatUnits6 } from './sources'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailsRow}>
      <span style={detailsLabel}>{label}</span>
      <span style={detailsValue}>{value}</span>
    </div>
  )
}

/** Collapsible details: minimum, Relay fee, processing time, max deposit. */
export function DepositDetails({ pm, token }: { pm: PaymentMethod; token: string }) {
  const [open, setOpen] = useState(false)
  const { triggerResize } = useOpenfort()
  // Grow/shrink the modal to fit the expanded rows.
  useEffect(() => {
    triggerResize()
  }, [open, triggerResize])
  const relayFee = pm.fees.find((f) => f.kind === 'relayerService')
  const feeText = relayFee ? `≈ ${formatUnits6(relayFee.amount)} ${relayFee.currency}` : '—'

  return (
    <div style={detailsBox}>
      <button type="button" style={detailsToggle} onClick={() => setOpen((o) => !o)}>
        <span>Details</span>
        <span style={chevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div>
          <Row label="Minimum" value={relayFee ? `above ${formatUnits6(relayFee.amount)} ${token}` : '~0.10'} />
          <Row label="Relay fee" value={feeText} />
          <Row label="Processing time" value="< 1 min" />
          <Row label="Max deposit" value="Unlimited" />
        </div>
      )}
    </div>
  )
}
