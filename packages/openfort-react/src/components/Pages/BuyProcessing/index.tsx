'use client'

import { useEffect, useRef, useState } from 'react'

import Logos from '../../../assets/logos'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import { useOnramp } from '../../../hooks/openfort/useOnramp'
import { isCompleteWalletPay, isWalletPayMethod } from '../../../hooks/openfort/walletPay'
import styled from '../../../styles/styled'
import Button from '../../Common/Button'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles'
import SquircleSpinner from '../../Common/SquircleSpinner'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, PendingContainer, StackedButtonWrapper } from '../Buy/styles'

// In-page mount for the Coinbase native Pay button (Apple/Google Pay). The
// server returns Coinbase's hosted Pay-button URL; `allow="payment"` lets the
// wallet-pay sheet run inside the frame.
const WalletPayFrame = styled.iframe`
  width: 100%;
  height: 380px;
  margin-top: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
`

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
    // NATIVE wallet pay needs the OTP-verified identity; if it's somehow missing
    // (e.g. a stale reload), send the buyer back to gather it rather than commit
    // a request the server will reject. Wallet pay resolved to the HOSTED
    // checkout ('iframe') commits like a card — no identity; unknown angle is
    // treated as native, the safe direction.
    const walletPay = isCompleteWalletPay(buyForm.walletPay) ? buyForm.walletPay : undefined
    if (isWalletPayMethod(buyForm.method) && buyForm.walletPayAngle !== 'iframe' && !walletPay) {
      setRoute(routes.BUY_WALLET_PAY_CONTACT)
      return
    }
    startedRef.current = true
    const fiatAmount = Number(buyForm.amount)
    openRef
      .current({
        sourceAmount: Number.isFinite(fiatAmount) && fiatAmount > 0 ? fiatAmount.toFixed(2) : undefined,
        sourceCurrency: buyForm.currency,
        redirectUrl: typeof window === 'undefined' ? undefined : `${window.location.origin}?onramp=success`,
        walletPay,
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
  }, [buyForm.session, buyForm.amount, buyForm.currency, buyForm.method, buyForm.walletPay, setRoute])

  // Re-measure the modal as the state machine advances.
  useEffect(() => {
    triggerResize()
  }, [triggerResize, onramp.status, failed, showContinueButton])

  // Offer a manual advance after a while — settlement webhooks can lag the
  // provider's own success screen. Suppressed while the native Pay button is
  // mounted (the buyer is still in the sheet — advancing would skip payment);
  // for native it only appears once payment is received (status 'processing').
  useEffect(() => {
    const nativeAwaitingPayment = onramp.angle === 'native' && onramp.status === 'waiting_payment'
    if ((onramp.status !== 'waiting_payment' && onramp.status !== 'processing') || nativeAwaitingPayment) return
    const timer = setTimeout(() => setShowContinueButton(true), 5_000)
    return () => clearTimeout(timer)
  }, [onramp.status, onramp.angle])

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
  // Native wallet pay mounts Coinbase's in-page Pay button once the commit
  // returns its URL and while we await payment; every other angle (and the
  // post-payment 'processing' delivery) shows the spinner.
  const showWalletPayFrame = onramp.angle === 'native' && !!onramp.url && onramp.status === 'waiting_payment'

  return (
    <PageContent onBack={handleBack}>
      <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
        <ModalHeading>
          {starting ? 'Preparing checkout' : showWalletPayFrame ? 'Complete your purchase' : 'Processing purchase'}
        </ModalHeading>
        <ModalBody>
          {starting
            ? 'Please wait…'
            : showWalletPayFrame
              ? 'Pay securely with Apple Pay or Google Pay below.'
              : onramp.status === 'processing'
                ? 'Payment received — delivering your funds…'
                : 'Complete the purchase in the checkout window.'}
        </ModalBody>

        {showWalletPayFrame ? (
          // Coinbase requires these exact iframe attributes for the in-page
          // Apple/Google Pay sheet to run (headless onramp docs).
          <WalletPayFrame
            src={onramp.url ?? undefined}
            title="Coinbase Pay"
            allow="payment"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
          />
        ) : (
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
        )}

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
