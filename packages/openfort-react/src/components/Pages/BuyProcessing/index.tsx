'use client'

import { useEffect, useRef, useState } from 'react'

import Logos from '../../../assets/logos'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import { useOnramp } from '../../../hooks/openfort/useOnramp'
import Button from '../../Common/Button'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles'
import SquircleSpinner from '../../Common/SquircleSpinner'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, PendingContainer, StackedButtonWrapper } from '../Buy/styles'

/**
 * Commit-and-track screen for a fiat buy. The amount screen minted the funding
 * session; this one sets the onramp payment method (the server resolves the
 * provider), opens the hosted checkout, and follows the SESSION status — the
 * popup is never the source of truth, settlement webhooks are.
 */
const BuyProcessing = () => {
  const { buyForm, setRoute, triggerResize } = useOpenfort()

  const onramp = useOnramp(buyForm.session, backendMethodId(buyForm.method), { useBackendUrl: true })
  const openRef = useRef(onramp.open)
  openRef.current = onramp.open
  const [failed, setFailed] = useState<string | null>(null)
  const [showContinueButton, setShowContinueButton] = useState(false)

  // Commit once per mount. A session takes a single payment method, so a retry
  // goes back to the amount screen, which mints a fresh session.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    if (!buyForm.session) {
      setRoute(routes.BUY)
      return
    }
    startedRef.current = true
    const fiatAmount = Number(buyForm.amount)
    openRef
      .current({
        sourceAmount: Number.isFinite(fiatAmount) && fiatAmount > 0 ? fiatAmount.toFixed(2) : undefined,
        sourceCurrency: buyForm.currency,
        redirectUrl: typeof window === 'undefined' ? undefined : `${window.location.origin}?onramp=success`,
      })
      .then((session) => {
        if (session.status === 'succeeded') {
          setRoute(routes.BUY_COMPLETE)
        } else {
          setFailed(
            session.status === 'bounced'
              ? 'The purchase was reversed and refunded by the provider.'
              : 'The purchase was not completed in time.'
          )
        }
      })
      .catch((e) => {
        setFailed(e instanceof Error ? e.message : 'Failed to start the purchase.')
      })
  }, [buyForm.session, buyForm.amount, buyForm.currency, setRoute])

  // Re-measure the modal as the state machine advances.
  useEffect(() => {
    triggerResize()
  }, [triggerResize, onramp.status, failed, showContinueButton])

  // Offer a manual advance after a while — settlement webhooks can lag the
  // provider's own success screen.
  useEffect(() => {
    if (onramp.status !== 'waiting_payment' && onramp.status !== 'processing') return
    const timer = setTimeout(() => setShowContinueButton(true), 5_000)
    return () => clearTimeout(timer)
  }, [onramp.status])

  const handleBack = () => {
    onramp.reset()
    setRoute(routes.BUY)
  }

  if (failed) {
    return (
      <PageContent onBack={handleBack}>
        <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
          <ModalHeading>Purchase not completed</ModalHeading>
          <ModalBody>{failed}</ModalBody>
          <ContinueButtonWrapper style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={handleBack}>
              Try again
            </Button>
          </ContinueButtonWrapper>
        </ModalContent>
      </PageContent>
    )
  }

  const starting = onramp.status === 'idle' || onramp.loading

  return (
    <PageContent onBack={handleBack}>
      <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
        <ModalHeading>{starting ? 'Preparing checkout' : 'Processing purchase'}</ModalHeading>
        <ModalBody>
          {starting
            ? 'Please wait…'
            : onramp.status === 'processing'
              ? 'Payment received — delivering your funds…'
              : 'Complete the purchase in the checkout window.'}
        </ModalBody>

        <PendingContainer>
          <SquircleSpinner
            logo={
              <div
                style={{
                  padding: '12px',
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Logos.Openfort />
              </div>
            }
            connecting={true}
          />
        </PendingContainer>

        {showContinueButton && (
          <>
            <ModalBody>Finished in the checkout window?</ModalBody>
            <StackedButtonWrapper>
              <Button variant="primary" onClick={() => setRoute(routes.BUY_COMPLETE)}>
                Continue
              </Button>
            </StackedButtonWrapper>
            <StackedButtonWrapper>
              <Button variant="secondary" onClick={handleBack}>
                Cancel
              </Button>
            </StackedButtonWrapper>
          </>
        )}
      </ModalContent>
    </PageContent>
  )
}

export default BuyProcessing
