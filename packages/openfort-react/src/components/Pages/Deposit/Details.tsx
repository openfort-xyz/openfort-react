'use client'

import { useEffect, useState } from 'react'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { chevron, detailsBox, detailsLabel, detailsRow, detailsToggle, detailsValue } from './formStyles'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailsRow}>
      <span style={detailsLabel}>{label}</span>
      <span style={detailsValue}>{value}</span>
    </div>
  )
}

/** Collapsible details: minimum amount, fee, time to receive, max deposit. */
export function DepositDetails() {
  const [open, setOpen] = useState(true)
  const { triggerResize } = useOpenfort()
  // Grow/shrink the modal to fit the expanded rows.
  useEffect(() => {
    triggerResize()
  }, [open, triggerResize])

  return (
    <div style={detailsBox}>
      <button type="button" style={detailsToggle} onClick={() => setOpen((o) => !o)}>
        <span>Details</span>
        <span style={chevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div>
          <Row label="Minimum amount" value="$1" />
          <Row label="Fee" value="Free" />
          <Row label="Time to receive" value="~10 sec" />
          <Row label="Max deposit" value="No limit" />
        </div>
      )}
    </div>
  )
}
