'use client'

import type { SessionStatus } from '../../../hooks/openfort/fundingClient.js'
import styled from '../../../styles/styled/index.js'
import { Spinner } from '../../Common/Spinner/index.js'

type Tone = 'pending' | 'success' | 'warn' | 'muted'

/** Live, user-facing copy for each non-initial session status. */
const STATUS_UI: Partial<Record<SessionStatus, { label: string; tone: Tone }>> = {
  waiting_payment: { label: 'Waiting for your deposit…', tone: 'pending' },
  processing: { label: 'Bridging your funds…', tone: 'pending' },
  succeeded: { label: 'Funds delivered to your wallet', tone: 'success' },
  bounced: { label: 'Deposit bounced — refunded to your wallet', tone: 'warn' },
  expired: { label: 'Session expired — reopen for a fresh address', tone: 'muted' },
}

const TONE_COLOR: Record<Tone, string> = {
  pending: 'var(--ck-body-color-muted, #6b7280)',
  success: '#16a34a',
  warn: '#d97706',
  muted: 'var(--ck-body-color-muted, #6b7280)',
}

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  background: var(--ck-body-background-secondary, #fafafa);
  font-size: 14px;
`

/**
 * Live funding status shown once a deposit address exists, so the user sees the
 * flow progress (waiting → bridging → delivered) and the terminal outcome.
 * Renders nothing before a payment method is set (`idle`/`requires_payment_method`).
 */
export function DepositStatus({ status }: { status: SessionStatus | 'idle' }) {
  const ui = status === 'idle' ? undefined : STATUS_UI[status]
  if (!ui) return null
  return (
    <Banner style={{ color: TONE_COLOR[ui.tone] }}>
      {ui.tone === 'pending' ? <Spinner /> : <span aria-hidden>{ui.tone === 'success' ? '✓' : '!'}</span>}
      <span>{ui.label}</span>
    </Banner>
  )
}
