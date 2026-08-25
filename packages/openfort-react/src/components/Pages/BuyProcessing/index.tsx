'use client'

import { useEffect, useRef, useState } from 'react'

import Logos from '../../../assets/logos.js'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi.js'
import { useOnramp } from '../../../hooks/openfort/useOnramp.js'
import { isCompleteWalletPay, isWalletPayMethod } from '../../../hooks/openfort/walletPay.js'
import styled from '../../../styles/styled/index.js'
import Button from '../../Common/Button/index.js'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles.js'
import SquircleSpinner from '../../Common/SquircleSpinner/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ContinueButtonWrapper, PendingContainer, SpinnerLogoBox, StackedButtonWrapper } from '../Buy/styles.js'

// In-page mount for the Coinbase native Pay button (Apple/Google Pay). The
// server returns Coinbase's hosted Pay-button URL; `allow="payment"` lets the
// wallet-pay sheet run inside the frame. The page renders a single ~44px Pay
// button centered in the frame's viewport (no resize events), so the frame
// hugs the button — the wallet-pay sheet itself is a native overlay, not
// constrained by the frame. When the page falls back to the Apple Pay QR
// experience (device can't present the sheet), it needs a full viewport.
// How long the mounted Pay-button frame may stay silent before we assume it
// never ran. A working frame reports within about a second.
const FRAME_SILENCE_MS = 6_000

const WalletPayFrame = styled.iframe<{ $qrFallback: boolean }>`
  width: 100%;
  height: ${({ $qrFallback }) => ($qrFallback ? '440px' : '60px')};
  margin-top: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
`

/**
 * Commit-and-track screen for a fiat buy on the `popup` and `native` angles
 * (the `embedded` angle runs in StripeLinkCheckout). The amount screen minted
 * the funding session; this one sets the onramp payment method (the server
 * resolves the provider), presents the checkout — a hosted popup or the
 * in-page Pay button — and follows the SESSION status, which the server
 * advances from settlement webhooks and provider polls.
 */
const BuyProcessing = () => {
  const { buyForm, setRoute, triggerResize } = useOpenfort()

  const onramp = useOnramp(buyForm.session, backendMethodId(buyForm.method), { useBackendUrl: true })
  const openRef = useRef(onramp.open)
  openRef.current = onramp.open
  const [failed, setFailed] = useState<string | null>(null)
  const [showContinueButton, setShowContinueButton] = useState(false)
  // Set once the Pay-button frame reports the payment was committed — the
  // button is done at that point, so the frame gives way to the spinner while
  // the session poll waits for settlement.
  const [framePaid, setFramePaid] = useState(false)

  // The frame reported this device can't present the Apple Pay sheet and is
  // showing the QR-code fallback instead — give it a viewport, not a strip.
  const [qrFallback, setQrFallback] = useState(false)

  // The Pay-button frame never said anything. The usual cause is the embedding
  // origin missing from the provider's frame-ancestors allowlist: the frame is
  // blocked, which still fires `load` but emits no onramp_api.* message, so
  // nothing below can tell the difference from a slow network. Offer the same
  // escape the provider's own sample recommends — open the checkout in a tab.
  const [frameSilent, setFrameSilent] = useState(false)
  const frameSpokeRef = useRef(false)

  // Native wallet pay mounts the provider's in-page Pay button once the commit
  // returns its URL and while we await payment; every other angle (and the
  // post-payment 'processing' delivery) shows the spinner.
  const showWalletPayFrame =
    onramp.angle === 'native' && !!onramp.url && onramp.status === 'waiting_payment' && !framePaid

  // Commit once per mount. A session takes a single payment method, so a retry
  // goes back to the amount screen, which mints a fresh session.
  const startedRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: commits once per mount (startedRef); the form fields listed are the order captured at that commit, and walletPayAngle is only read for the pre-commit guard
  useEffect(() => {
    if (startedRef.current) return
    if (!buyForm.session) {
      setRoute(routes.BUY)
      return
    }
    // NATIVE wallet pay needs the OTP-verified identity; if it's somehow missing
    // (e.g. a stale reload), send the buyer back to gather it rather than commit
    // a request the server will reject. Wallet pay resolved to the HOSTED
    // checkout ('popup') commits like a card — no identity; unknown angle is
    // treated as native, the safe direction.
    const walletPay = isCompleteWalletPay(buyForm.walletPay) ? buyForm.walletPay : undefined
    if (isWalletPayMethod(buyForm.method) && buyForm.walletPayAngle !== 'popup' && !walletPay) {
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
        } else if (session.status === 'bounced') {
          setFailed('The purchase was reversed and refunded by the provider.')
        } else if (session.status === 'expired') {
          setFailed('The purchase was not completed in time.')
        }
        // Non-terminal resolution = the poll was interrupted (e.g. a remount),
        // NOT an outcome — the mounted state machine keeps tracking the session.
      })
      .catch((e) => {
        setFailed(e instanceof Error ? e.message : 'Failed to start the purchase.')
      })
  }, [buyForm.session, buyForm.amount, buyForm.currency, buyForm.method, buyForm.walletPay, setRoute])

  // Re-measure the modal as the state machine advances.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers, not inputs — each state swaps in a differently sized body
  useEffect(() => {
    triggerResize()
  }, [
    triggerResize,
    onramp.status,
    failed,
    showContinueButton,
    framePaid,
    qrFallback,
    onramp.checkoutClosed,
    frameSilent,
  ])

  // Start the silence timer once the frame is actually mounted. FRAME_SILENCE_MS
  // is generous: a real Pay button reports within a second, so anything past
  // this is the frame not running at all.
  useEffect(() => {
    if (!showWalletPayFrame) return
    frameSpokeRef.current = false
    setFrameSilent(false)
    const timer = setTimeout(() => {
      if (!frameSpokeRef.current) setFrameSilent(true)
    }, FRAME_SILENCE_MS)
    return () => clearTimeout(timer)
  }, [showWalletPayFrame])

  // The Pay-button page reports its lifecycle via postMessage
  // (onramp_api.load_* / commit_* / polling_*, per the headless onramp docs) —
  // the only signal a cross-origin frame gives us. Session polling stays the
  // source of truth for settlement; these just drive what's on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the frame listener is registered once for the mount; setRoute is the provider's stable setter
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://pay.coinbase.com') return
      let payload: unknown = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }
      const { eventName, data } = (payload ?? {}) as {
        eventName?: string
        data?: { errorCode?: string; errorMessage?: string }
      }
      // Any message at all proves the frame rendered, so the silence timer below
      // must stand down even for events this screen doesn't otherwise act on.
      setFrameSilent(false)
      frameSpokeRef.current = true
      if (eventName === 'onramp_api.polling_success') {
        // The provider finished its own polling and the purchase succeeded.
        // This is the earliest definitive success we get on the native angle —
        // the session otherwise advances only when the settlement webhook lands,
        // which can lag badly and never arrives in local development.
        setFramePaid(true)
        setRoute(routes.BUY_COMPLETE)
      } else if (eventName === 'onramp_api.commit_success' || eventName === 'onramp_api.polling_start') {
        setFramePaid(true)
      } else if (
        eventName === 'onramp_api.load_error' ||
        eventName === 'onramp_api.commit_error' ||
        eventName === 'onramp_api.polling_error'
      ) {
        // Coinbase documents this load error as safe to ignore on web: the frame
        // falls back to an Apple Pay QR code the buyer scans with their phone.
        // The QR page needs a real viewport, not the Pay-button strip.
        if (data?.errorCode === 'ERROR_CODE_GUEST_APPLE_PAY_NOT_SUPPORTED') {
          setQrFallback(true)
          return
        }
        setFailed(data?.errorMessage ?? 'The payment could not be started. Please try again.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Offer a manual advance after a while — settlement webhooks can lag the
  // provider's own success screen. Suppressed while the native Pay button is
  // mounted (the buyer is still paying; advancing would skip it); it appears
  // once payment is received. Closing the checkout window skips the wait: there
  // is nothing left on screen for the buyer to finish in.
  useEffect(() => {
    // A silent frame is the exception: the buyer has nothing to press, so the
    // escape hatch must appear rather than be suppressed as "still paying".
    const inPageAwaitingPayment =
      onramp.angle === 'native' && !framePaid && onramp.status === 'waiting_payment' && !frameSilent
    if ((onramp.status !== 'waiting_payment' && onramp.status !== 'processing') || inPageAwaitingPayment) return
    if (onramp.checkoutClosed) {
      setShowContinueButton(true)
      return
    }
    const timer = setTimeout(() => setShowContinueButton(true), 5_000)
    return () => clearTimeout(timer)
  }, [onramp.status, onramp.angle, framePaid, onramp.checkoutClosed, frameSilent])

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
  const delivering = onramp.status === 'processing' || framePaid
  const openInTab = () => {
    if (onramp.url) window.open(onramp.url, '_blank', 'noopener,noreferrer')
  }
  // The buyer shut the hosted checkout before it settled. Not a failure — they
  // may have paid and closed it, and settlement can still arrive — but the
  // "finish in the checkout window" copy no longer describes anything on screen.
  const closedEarly = onramp.checkoutClosed && !delivering
  const canReopen = closedEarly && onramp.angle === 'popup' && !!onramp.url

  return (
    <PageContent onBack={handleBack}>
      <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
        <ModalHeading>
          {starting
            ? 'Preparing checkout'
            : showWalletPayFrame
              ? 'Complete your purchase'
              : closedEarly
                ? 'Checkout window closed'
                : 'Processing purchase'}
        </ModalHeading>
        {/* The provider's own Pay button carries its copy — no description is
            repeated above it. */}
        {!showWalletPayFrame && (
          <ModalBody>
            {starting
              ? 'Please wait…'
              : delivering
                ? 'Payment received — delivering your funds…'
                : closedEarly
                  ? "We're still checking for your payment. Reopen the checkout if you haven't finished."
                  : 'Complete the purchase in the checkout window.'}
          </ModalBody>
        )}

        {showWalletPayFrame ? (
          <>
            {/* `allow="payment"` is what lets the wallet-pay sheet run in the
                frame, and is all Coinbase's own sample sets. A `sandbox` here
                would have to grant popups, forms, modals and top-navigation for
                the sheet and the QR fallback to work, and `allow-scripts` with
                `allow-same-origin` lets the frame drop the sandbox anyway — so
                it bought nothing and risked breaking the sheet. */}
            <WalletPayFrame
              src={onramp.url ?? undefined}
              title="Coinbase Pay"
              allow="payment"
              $qrFallback={qrFallback}
            />
            {frameSilent && (
              <>
                <ModalBody>
                  The payment button couldn’t load here. Open the checkout in a new tab to finish paying.
                </ModalBody>
                <StackedButtonWrapper>
                  <Button variant="primary" onClick={openInTab}>
                    Open checkout in a new tab
                  </Button>
                </StackedButtonWrapper>
              </>
            )}
          </>
        ) : (
          <PendingContainer>
            <SquircleSpinner
              logo={
                <SpinnerLogoBox>
                  <Logos.Openfort />
                </SpinnerLogoBox>
              }
              connecting={true}
            />
          </PendingContainer>
        )}

        {showContinueButton && (
          <>
            {!closedEarly && <ModalBody>Finished in the checkout window?</ModalBody>}
            {canReopen && (
              <StackedButtonWrapper>
                <Button variant="primary" onClick={onramp.present}>
                  Reopen checkout
                </Button>
              </StackedButtonWrapper>
            )}
            <StackedButtonWrapper>
              <Button variant={canReopen ? 'secondary' : 'primary'} onClick={() => setRoute(routes.BUY_COMPLETE)}>
                {closedEarly ? "I've completed payment" : 'Continue'}
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
