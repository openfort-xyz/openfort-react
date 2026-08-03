'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Logos from '../../../assets/logos'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi'
import {
  createStripeOnrampCoordinator,
  type StripeKycInfo,
  type StripeOnrampCoordinator,
  stripeNetworkForChain,
} from '../../../hooks/openfort/stripeCryptoOnramp'
import { useFundingClient } from '../../../hooks/openfort/useFunding'
import { useOnramp } from '../../../hooks/openfort/useOnramp'
import { useUser } from '../../../hooks/openfort/useUser'
import { logger } from '../../../utils/logger'
import { getPublishableKeyEnvironment, isValidEmail } from '../../../utils/validation'
import Button from '../../Common/Button'
import Input from '../../Common/Input'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import SquircleSpinner from '../../Common/SquircleSpinner'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, PendingContainer } from '../Buy/styles'

type Step =
  | 'init' // loading Stripe's script + coordinator
  | 'email' // collect the Link email
  | 'register' // first-time buyer: phone (+ name) to create the Link user
  | 'auth' // Stripe's Link authentication element (OTP)
  | 'kyc' // first-time buyer: identity Stripe requires before checkout
  | 'payment' // Stripe's collectPaymentMethod element
  | 'checkout' // commit + performCheckout + settlement polling

/**
 * Stripe v2 (Link-auth headless) checkout — the `embedded` angle's element
 * flow. The buyer authenticates with Link (register first if new), Stripe's
 * elements collect identity + payment method IN the widget, and the commit
 * creates a headless Stripe session this screen checks out and tracks to
 * settlement. All Stripe UI stays inside the modal; nothing opens a popup.
 */
const StripeLinkCheckout: React.FC = () => {
  const { buyForm, setRoute, triggerResize, publishableKey, uiConfig } = useOpenfort()
  const { user } = useUser()
  const client = useFundingClient({ useBackendUrl: true })
  const onramp = useOnramp(buyForm.session, backendMethodId(buyForm.method), { useBackendUrl: true })
  const isTestMode = getPublishableKeyEnvironment(publishableKey) === 'test'
  // Link registration wants the buyer's country; the widget's configured
  // country matches how the method row was resolved.
  const buyerCountry = uiConfig.funding?.country ?? 'US'

  const [step, setStep] = useState<Step>('init')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  // Set when this flow registered the Link user — Stripe then needs KYC before
  // the checkout, so the identity step is shown after authentication.
  const registeredRef = useRef(false)

  const coordinatorRef = useRef<StripeOnrampCoordinator | null>(null)
  const intentIdRef = useRef<string | null>(null)
  const cryptoCustomerIdRef = useRef<string | null>(null)
  const paymentTokenRef = useRef<string | null>(null)
  const elementHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    triggerResize()
  }, [triggerResize, step, error])

  // Boot the coordinator from the publishable key the method row carried.
  useEffect(() => {
    const key = buyForm.stripeLink?.publishableKey
    if (!key || !buyForm.session) {
      setRoute(routes.BUY)
      return
    }
    let cancelled = false
    createStripeOnrampCoordinator(key, { theme: 'stripe' })
      .then((coordinator) => {
        if (cancelled) {
          coordinator.destroy()
          return
        }
        coordinatorRef.current = coordinator
        setStep('email')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the Stripe checkout.')
      })
    return () => {
      cancelled = true
      coordinatorRef.current?.destroy()
      coordinatorRef.current = null
    }
    // The page mounts once per attempt; the session/key never change mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Mount a Stripe element into the host div (replacing any previous one). */
  const mountElement = (element: HTMLElement | null) => {
    const host = elementHostRef.current
    if (!host || !element) return
    host.replaceChildren(element)
    triggerResize()
  }

  /** Mint the LinkAuthIntent and mount the authentication element. */
  const startAuthentication = useCallback(
    async (forEmail: string) => {
      const coordinator = coordinatorRef.current
      if (!coordinator || !client) return
      setError(null)
      setLoading(true)
      try {
        const intent = await client.stripeLink.createAuthIntent({ email: forEmail })
        intentIdRef.current = intent.id
        setStep('auth')
        const element = await coordinator.authenticate(intent.id, (result) => {
          if (result.result !== 'success' || !result.crypto_customer_id) {
            setError(result.result === 'declined' ? 'Link authentication was declined.' : null)
            setStep('email')
            return
          }
          cryptoCustomerIdRef.current = result.crypto_customer_id
          void completeAuthentication()
        })
        mountElement(element)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not start Link authentication.'
        // A brand-new buyer has no Link consumer yet — register first.
        if (/consumer|not.*found|no.*link/i.test(message)) {
          setStep('register')
        } else {
          setError(message)
        }
      } finally {
        setLoading(false)
      }
    },
    // completeAuthentication is stable (refs only); listing it would recreate the flow per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client]
  )

  /**
   * After Link auth: exchange the intent for its server-side token, register
   * the destination wallet on the Link user, then continue to identity (new
   * buyers) or straight to payment collection.
   */
  const completeAuthentication = async () => {
    const coordinator = coordinatorRef.current
    const intentId = intentIdRef.current
    const session = buyForm.session
    if (!coordinator || !intentId || !client || !session) return
    setLoading(true)
    setError(null)
    try {
      await client.stripeLink.exchangeToken(intentId)
      // Register the session's destination wallet with the Link user so the
      // headless session can deliver to it. Best-effort: an already-registered
      // wallet errors harmlessly and the commit surfaces anything real.
      try {
        const full = await client.sessions.get(session.id, { clientSecret: session.clientSecret })
        const network = stripeNetworkForChain(full.target.chain)
        if (network) await coordinator.registerWalletAddress(full.target.address, network)
      } catch (e) {
        logger.log('[stripe-link] wallet registration skipped', e)
      }
      setStep(registeredRef.current ? 'kyc' : 'payment')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link authentication could not be completed.')
      setStep('email')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailContinue = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    await startAuthentication(email.trim())
  }

  const handleRegister = async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return
    if (!/^\+\d{8,15}$/.test(phone.trim())) {
      setError('Enter your mobile number in international format, e.g. +14155550123.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await coordinator.registerLinkUser(email.trim(), phone.trim(), buyerCountry, fullName.trim() || undefined)
      registeredRef.current = true
      await startAuthentication(email.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the Link account.')
    } finally {
      setLoading(false)
    }
  }

  // ---- KYC (first-time buyers) ----
  const [kyc, setKyc] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    ssn: '',
  })
  const setKycField = (field: keyof typeof kyc) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setKyc((prev) => ({ ...prev, [field]: e.target.value }))

  const handleKycSubmit = async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return
    const dobMatch = kyc.dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dobMatch) {
      setError('Enter your date of birth as YYYY-MM-DD.')
      return
    }
    const info: StripeKycInfo = {
      given_name: kyc.firstName.trim(),
      surname: kyc.lastName.trim(),
      date_of_birth: { year: Number(dobMatch[1]), month: Number(dobMatch[2]), day: Number(dobMatch[3]) },
      address: {
        country: buyerCountry,
        line1: kyc.line1.trim(),
        city: kyc.city.trim(),
        state: kyc.state.trim(),
        postal_code: kyc.postalCode.trim(),
      },
      ...(kyc.ssn.trim() ? { id_number: { type: 'us_ssn' as const, value: kyc.ssn.replace(/\D/g, '') } } : {}),
    }
    setError(null)
    setLoading(true)
    try {
      await coordinator.submitKycInfo(info)
      setStep('payment')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identity verification failed.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Payment collection element ----
  const paymentMounted = useRef(false)
  useEffect(() => {
    const coordinator = coordinatorRef.current
    if (step !== 'payment' || !coordinator || paymentMounted.current) return
    paymentMounted.current = true
    coordinator
      .collectPaymentMethod(
        { payment_method_types: ['card'], wallets: { applePay: 'never', googlePay: 'never' } },
        (result) => {
          paymentTokenRef.current = result.cryptoPaymentToken
          setStep('checkout')
        }
      )
      .then(mountElement)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load the payment form.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ---- Commit + checkout + settlement ----
  const [failed, setFailed] = useState<string | null>(null)
  const commitStarted = useRef(false)
  useEffect(() => {
    if (step !== 'checkout' || commitStarted.current) return
    const intentId = intentIdRef.current
    const customerId = cryptoCustomerIdRef.current
    const token = paymentTokenRef.current
    if (!intentId || !customerId || !token) return
    commitStarted.current = true
    const fiatAmount = Number(buyForm.amount)
    onramp
      .open({
        sourceAmount: Number.isFinite(fiatAmount) && fiatAmount > 0 ? fiatAmount.toFixed(2) : undefined,
        sourceCurrency: buyForm.currency,
        stripeLink: { linkAuthIntentId: intentId, cryptoCustomerId: customerId, cryptoPaymentToken: token },
      })
      .then((session) => {
        if (session.status === 'succeeded') setRoute(routes.BUY_COMPLETE)
        else if (session.status === 'bounced') setFailed('The purchase was reversed and refunded by the provider.')
        else if (session.status === 'expired') setFailed('The purchase was not completed in time.')
      })
      .catch((e) => {
        setFailed(e instanceof Error ? e.message : 'Failed to start the purchase.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Once the commit lands, drive Stripe's headless checkout: performCheckout
  // redeems our one-shot element secret (mandate acceptance happens server-side
  // on that call). Session polling above remains the settlement source of truth.
  const checkoutStarted = useRef(false)
  const committedPm = onramp.session?.paymentMethod
  const providerSessionId = committedPm?.type === 'onramp' ? (committedPm.providerSessionId ?? null) : null
  useEffect(() => {
    const coordinator = coordinatorRef.current
    const session = buyForm.session
    if (!providerSessionId || !coordinator || !client || !session || checkoutStarted.current) return
    checkoutStarted.current = true
    coordinator
      .performCheckout(providerSessionId, async () => {
        const res = await client.sessions.onrampCheckout(session.id, { clientSecret: session.clientSecret })
        return res.clientSecret
      })
      .then((result) => {
        if (!result.successful) setFailed('The payment was not completed.')
      })
      .catch((e) => {
        setFailed(e instanceof Error ? e.message : 'The payment could not be processed.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerSessionId])

  const handleBack = () => {
    onramp.reset()
    setRoute(routes.BUY)
  }

  if (failed) {
    return (
      <PageContent onBack={handleBack}>
        <ModalHeading>Purchase not completed</ModalHeading>
        <ModalBody>{failed}</ModalBody>
        <ContinueButtonWrapper>
          <Button variant="primary" onClick={handleBack}>
            Try again
          </Button>
        </ContinueButtonWrapper>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>Pay with card</ModalHeading>

      {step === 'init' && (
        <>
          <ModalBody>Loading secure checkout…</ModalBody>
          {error && <ModalBody $error>{error}</ModalBody>}
        </>
      )}

      {step === 'email' && (
        <>
          <ModalBody>Checkout is powered by Link. Enter your email to continue.</ModalBody>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleEmailContinue} disabled={!isValidEmail(email)} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {step === 'register' && (
        <>
          <ModalBody>
            Create your Link account — enter your mobile number{isTestMode ? ' (sandbox: any +1 number)' : ''} and name.
          </ModalBody>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="+1 415 555 0123"
            autoComplete="tel"
          />
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            placeholder={isTestMode ? 'Full name (sandbox: John Verified)' : 'Full name'}
            autoComplete="name"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleRegister} disabled={!phone.trim()} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {step === 'kyc' && (
        <>
          <ModalBody>Verify your identity to finish setting up purchases.</ModalBody>
          <Input value={kyc.firstName} onChange={setKycField('firstName')} type="text" placeholder="First name" />
          <Input value={kyc.lastName} onChange={setKycField('lastName')} type="text" placeholder="Last name" />
          <Input
            value={kyc.dob}
            onChange={setKycField('dob')}
            type="text"
            inputMode="numeric"
            placeholder="Date of birth (YYYY-MM-DD)"
          />
          <Input
            value={kyc.line1}
            onChange={setKycField('line1')}
            type="text"
            placeholder={isTestMode ? 'Street address (sandbox: address_full_match)' : 'Street address'}
            autoComplete="address-line1"
          />
          <Input
            value={kyc.city}
            onChange={setKycField('city')}
            type="text"
            placeholder="City"
            autoComplete="address-level2"
          />
          <Input
            value={kyc.state}
            onChange={setKycField('state')}
            type="text"
            placeholder="State (e.g. CA)"
            autoComplete="address-level1"
          />
          <Input
            value={kyc.postalCode}
            onChange={setKycField('postalCode')}
            type="text"
            inputMode="numeric"
            placeholder="ZIP code"
            autoComplete="postal-code"
          />
          <Input
            value={kyc.ssn}
            onChange={setKycField('ssn')}
            type="text"
            inputMode="numeric"
            placeholder={isTestMode ? 'SSN (sandbox: 000000000)' : 'SSN'}
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button
              variant="primary"
              onClick={handleKycSubmit}
              disabled={!kyc.firstName.trim() || !kyc.lastName.trim() || !kyc.dob.trim()}
              waiting={loading}
            >
              Continue
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {(step === 'auth' || step === 'payment') && (
        <>
          <ModalBody>
            {step === 'auth' ? 'Confirm the code Link sent you.' : 'Enter your card details to complete the purchase.'}
          </ModalBody>
          {error && <ModalBody $error>{error}</ModalBody>}
        </>
      )}
      {/* Stripe's elements mount here (auth OTP + card form). Kept in the tree
          across steps so an element never unmounts mid-callback. */}
      <div ref={elementHostRef} style={{ display: step === 'auth' || step === 'payment' ? 'block' : 'none' }} />

      {step === 'checkout' && (
        <>
          <ModalBody>
            {onramp.status === 'processing' ? 'Payment received — delivering your funds…' : 'Processing your payment…'}
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
        </>
      )}
    </PageContent>
  )
}

export default StripeLinkCheckout
