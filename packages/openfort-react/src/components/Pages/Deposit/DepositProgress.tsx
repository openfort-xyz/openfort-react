'use client'

import { useEffect, useState } from 'react'
import type { SessionStatus } from '../../../hooks/openfort/fundingClient'
import styled from '../../../styles/styled'
import { logger } from '../../../utils/logger'
import Button from '../../Common/Button'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import PoweredByFooter from '../../Common/PoweredByFooter'
import { Spinner } from '../../Common/Spinner'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { DepositSuccess } from './DepositSuccess'

/**
 * Statuses that take over the whole modal with the compact flow view: once a
 * deposit is detected the form is gone and only progress/outcome is shown.
 */
export function isDepositFlowActive(status: SessionStatus | 'idle'): boolean {
  return status === 'processing' || status === 'succeeded' || status === 'bounced' || status === 'expired'
}

/** How long the final "Delivering" step stays visible before the confirmed screen. */
const DELIVERING_HOLD_MS = 1200

type StepState = 'done' | 'active' | 'pending'

const STEPS = [
  { key: 'received', label: 'Payment received' },
  { key: 'bridging', label: 'Bridging across chains' },
  { key: 'delivering', label: 'Delivering to your wallet' },
] as const

function stepStateFor(index: number, activeStep: number): StepState {
  if (index < activeStep) return 'done'
  if (index === activeStep) return 'active'
  return 'pending'
}

const StepList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin: 18px 0 8px;
  width: 100%;
  text-align: left;
`

const StepRow = styled.div<{ $state: StepState }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  background: ${(p) => (p.$state === 'active' ? 'var(--ck-body-background-secondary, #fafafa)' : 'transparent')};
  color: ${(p) => (p.$state === 'pending' ? 'var(--ck-body-color-muted, #9ca3af)' : 'var(--ck-body-color, #111)')};
  font-weight: ${(p) => (p.$state === 'active' ? 600 : 400)};
`

const StepMark = styled.span<{ $state: StepState }>`
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  background: ${(p) =>
    p.$state === 'done' ? '#16a34a' : p.$state === 'pending' ? 'var(--ck-body-divider, #e4e4e7)' : 'transparent'};
`

/** Outcome copy for the non-success terminal states. */
const OUTCOME: Partial<Record<SessionStatus, { heading: string; body: string }>> = {
  bounced: { heading: 'Deposit refunded', body: 'The bridge bounced your deposit and refunded it to your wallet.' },
  expired: { heading: 'Session expired', body: 'Reopen the deposit to get a fresh address.' },
}

/**
 * Compact flow view shown once a deposit is detected. `processing` renders a live
 * stepper (payment received → bridging → delivering); on `succeeded` the third
 * step holds active briefly so the user sees it, then the tick + "See balance"
 * screen takes over. `bounced`/`expired` show the outcome with a way out.
 */
export function DepositProgress({ status }: { status: SessionStatus | 'idle' }) {
  const { setRoute, triggerResize } = useOpenfort()
  const [delivered, setDelivered] = useState(false)

  // On success, hold on the "Delivering" step for a beat before the confirmed
  // screen — otherwise the flow jumps straight from bridging to confirmed.
  useEffect(() => {
    if (status !== 'succeeded') return
    const id = setTimeout(() => setDelivered(true), DELIVERING_HOLD_MS)
    return () => clearTimeout(id)
  }, [status])

  // Resize the modal whenever the visible step / screen changes.
  useEffect(() => {
    triggerResize()
    // Correlate the perceived terminal (incl. the 1.2s delivering hold) with the
    // data-layer terminal from useFunding; UI is unchanged.
    logger.log('[funding:progress] render', { status, delivered })
  }, [status, delivered, triggerResize])

  if (status === 'succeeded' && delivered) return <DepositSuccess />

  if (status === 'bounced' || status === 'expired') {
    const ui = OUTCOME[status]
    return (
      <PageContent>
        <ModalHeading>{ui?.heading}</ModalHeading>
        <ModalBody>{ui?.body}</ModalBody>
        <Button variant="primary" onClick={() => setRoute(status === 'expired' ? routes.DEPOSIT : routes.CONNECTED)}>
          {status === 'expired' ? 'Start over' : 'See balance'}
        </Button>
        <PoweredByFooter />
      </PageContent>
    )
  }

  // processing → bridging active (step 1); succeeded (pre-confirmed) → delivering active (step 2).
  const activeStep = status === 'succeeded' ? 2 : 1

  return (
    <PageContent>
      <ModalHeading>Completing your deposit</ModalHeading>
      <ModalBody>Keep this open — your funds are on the way.</ModalBody>
      <StepList>
        {STEPS.map((step, i) => {
          const state = stepStateFor(i, activeStep)
          return (
            <StepRow key={step.key} $state={state}>
              {state === 'active' ? <Spinner /> : <StepMark $state={state}>{state === 'done' ? '✓' : ''}</StepMark>}
              <span>{step.label}</span>
            </StepRow>
          )
        })}
      </StepList>
      <PoweredByFooter />
    </PageContent>
  )
}
