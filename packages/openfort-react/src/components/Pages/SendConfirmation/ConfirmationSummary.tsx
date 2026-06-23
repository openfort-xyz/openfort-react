'use client'

import type { ReactNode } from 'react'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import {
  AddressValue,
  AmountValue,
  FiatValue,
  NetworkValue,
  PayWithAddress,
  PayWithBadge,
  PayWithCard,
  PayWithMeta,
  SummaryItem,
  SummaryLabel,
  SummaryList,
} from './styles'

export type ConfirmationAddress = { display: string; value: string }

interface ConfirmationSummaryProps {
  /** Total being sent, e.g. "0.5" + "ETH". */
  amount: string
  symbol: string
  /** Optional fiat estimate shown next to the total, e.g. "$180.84". */
  fiat?: string | null
  /** Recipient address (truncated for display, full for copy). */
  to?: ConfirmationAddress
  networkName: string
  networkIcon?: ReactNode
  /** Fee cell — the live estimate, or a "Sponsored" indicator. */
  fee: ReactNode
  /** The wallet the funds are paid from. */
  payWith?: ConfirmationAddress
}

/**
 * Shared, chain-agnostic transaction preview used by the EVM and Solana send
 * confirmation screens. Renders the approval-style rows (Total / To / Network /
 * Estimated fee) plus a "Pay with" card.
 */
export function ConfirmationSummary({
  amount,
  symbol,
  fiat,
  to,
  networkName,
  networkIcon,
  fee,
  payWith,
}: ConfirmationSummaryProps) {
  return (
    <>
      <SummaryList>
        <SummaryItem>
          <SummaryLabel>Total</SummaryLabel>
          <AmountValue>
            {amount || '0'} {symbol}
            {fiat ? <FiatValue>≈ {fiat}</FiatValue> : null}
          </AmountValue>
        </SummaryItem>

        <SummaryItem>
          <SummaryLabel>To</SummaryLabel>
          <AddressValue>
            {to ? (
              <CopyText size="1rem" value={to.value}>
                {to.display}
              </CopyText>
            ) : (
              '--'
            )}
          </AddressValue>
        </SummaryItem>

        <SummaryItem>
          <SummaryLabel>Network</SummaryLabel>
          <NetworkValue>
            {networkIcon}
            {networkName}
          </NetworkValue>
        </SummaryItem>

        <SummaryItem>
          <SummaryLabel>Estimated fee</SummaryLabel>
          {fee}
        </SummaryItem>
      </SummaryList>

      <PayWithCard>
        <PayWithMeta>
          <SummaryLabel>Pay with</SummaryLabel>
          <PayWithAddress>
            {payWith ? (
              <CopyText size="0.875rem" value={payWith.value}>
                {payWith.display}
              </CopyText>
            ) : (
              '--'
            )}
          </PayWithAddress>
        </PayWithMeta>
        <PayWithBadge>
          {amount || '0'} {symbol}
        </PayWithBadge>
      </PayWithCard>
    </>
  )
}
