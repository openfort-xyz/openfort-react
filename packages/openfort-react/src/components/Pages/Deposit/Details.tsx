'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import type { PaymentMethod } from '../../../hooks/openfort/useFunding'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { chevron, detailsBox, detailsLabel, detailsRow, detailsToggle, detailsValue } from './formStyles'

type SourceCurrency = { symbol: string; decimals: number }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailsRow}>
      <span style={detailsLabel}>{label}</span>
      <span style={detailsValue}>{value}</span>
    </div>
  )
}

/** Rail fees charged in the source currency (relayer gas + service). Origin-chain
 * gas is paid by the sender's own transaction, so it's not summed here. */
function formatRailFee(pm: PaymentMethod, currency: SourceCurrency): string {
  const total = pm.fees
    .filter((fee) => fee.currency === currency.symbol)
    .reduce((sum, fee) => sum + BigInt(fee.amount), BigInt(0))
  if (total === BigInt(0)) return 'Free'
  return `≈ ${formatUnits(total, currency.decimals)} ${currency.symbol}`
}

function formatMin(pm: PaymentMethod, currency: SourceCurrency): string {
  if (!pm.minAmount) return 'None'
  return `${formatUnits(BigInt(pm.minAmount), currency.decimals)} ${currency.symbol}`
}

/** Collapsible details: minimum amount, rail fee, time to receive, max deposit.
 * Pulls the minimum and fee from the live quote (`pm`) when available. */
export function DepositDetails({
  pm,
  sourceCurrency,
}: {
  pm: PaymentMethod | null
  sourceCurrency: SourceCurrency | null
}) {
  const [open, setOpen] = useState(true)
  const { triggerResize } = useOpenfort()
  // Grow/shrink the modal to fit the expanded rows.
  useEffect(() => {
    triggerResize()
  }, [open, triggerResize])

  const fee = pm && sourceCurrency ? formatRailFee(pm, sourceCurrency) : '—'
  const min = pm && sourceCurrency ? formatMin(pm, sourceCurrency) : '—'

  return (
    <div style={detailsBox}>
      <button type="button" style={detailsToggle} onClick={() => setOpen((o) => !o)}>
        <span>Details</span>
        <span style={chevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div>
          <Row label="Minimum amount" value={min} />
          <Row label="Fee" value={fee} />
          <Row label="Time to receive" value="~10 sec" />
          <Row label="Max deposit" value="No limit" />
        </div>
      )}
    </div>
  )
}
