'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CountryIso2 } from 'react-international-phone'
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
import EmailField from '../../Common/EmailField'
import { ErrorText } from '../../Common/ErrorText'
import LabeledField from '../../Common/LabeledField'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import PhoneField from '../../Common/PhoneField'
import { Skeleton, SkeletonStack } from '../../Common/Skeleton'
import SquircleSpinner from '../../Common/SquircleSpinner'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, PendingContainer } from '../Buy/styles'
import { FooterButtonText, FooterTextButton } from '../EmailOTP/styles'

type Step =
  | 'init' // loading Stripe's script + coordinator
  | 'email' // collect the Link email
  | 'register' // first-time buyer: phone (+ name) to create the Link user
  | 'auth' // Stripe's Link authentication element (OTP)
  | 'kyc' // first-time buyer: identity Stripe requires before checkout
  | 'payment' // Stripe's collectPaymentMethod element
  | 'checkout' // commit + performCheckout + settlement polling

// EU/EEA countries whose addresses make Stripe require birth details and a
// national identifier instead of the US state + SSN pair.
const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'ES',
])

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
  const isEU = EU_COUNTRIES.has(buyerCountry.toUpperCase())
  // The same Link flow serves both rails — only the collected payment method
  // differs: card, or a US bank account for the ACH bank-transfer row.
  const isBankTransfer = buyForm.method === FundingMethod.BANK_TRANSFER

  const [step, setStep] = useState<Step>('init')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // False while a Stripe element is being fetched — the host shows a skeleton
  // placeholder instead of empty space until the element lands.
  const [elementReady, setElementReady] = useState(false)

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
    setElementReady(true)
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
        const intent = await client.authIntents.create({ email: forEmail })
        intentIdRef.current = intent.id
        setElementReady(false)
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
      await client.authIntents.exchangeToken(intentId)
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

  /** Back out of the mounted auth element to re-enter the email. */
  const handleChangeEmail = () => {
    intentIdRef.current = null
    elementHostRef.current?.replaceChildren()
    setElementReady(false)
    setError(null)
    setStep('email')
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
    birthCity: '',
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
    // The identity Stripe expects differs by region: US addresses take a state
    // + SSN; EU addresses take birth details instead.
    const info: StripeKycInfo = {
      given_name: kyc.firstName.trim(),
      surname: kyc.lastName.trim(),
      date_of_birth: { year: Number(dobMatch[1]), month: Number(dobMatch[2]), day: Number(dobMatch[3]) },
      address: {
        country: buyerCountry,
        line1: kyc.line1.trim(),
        city: kyc.city.trim(),
        postal_code: kyc.postalCode.trim(),
        ...(isEU ? {} : { state: kyc.state.trim() }),
      },
      ...(isEU
        ? { birth_city: kyc.birthCity.trim(), birth_country: buyerCountry }
        : kyc.ssn.trim()
          ? { id_number: { type: 'us_ssn' as const, value: kyc.ssn.replace(/\D/g, '') } }
          : {}),
    }
    setError(null)
    setLoading(true)
    try {
      await coordinator.submitKycInfo(info)
      // Reached from the commit's identity-verification rejection (payment
      // already collected)? Retry the checkout; otherwise collect payment next.
      if (paymentTokenRef.current) {
        commitStarted.current = false
        setStep('checkout')
      } else {
        setStep('payment')
      }
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
    setElementReady(false)
    coordinator
      .collectPaymentMethod(
        {
          payment_method_types: [isBankTransfer ? 'us_bank_account' : 'card'],
          wallets: { applePay: 'never', googlePay: 'never' },
        },
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
        embedded: { authIntentId: intentId, customerRef: customerId, paymentToken: token },
      })
      .then((session) => {
        if (session.status === 'succeeded') setRoute(routes.BUY_COMPLETE)
        else if (session.status === 'bounced') setFailed('The purchase was reversed and refunded by the provider.')
        else if (session.status === 'expired') setFailed('The purchase was not completed in time.')
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to start the purchase.'
        // Stripe rejects the session until the buyer's identity is verified —
        // collect it and retry rather than dead-ending the purchase.
        if (/identity verification/i.test(message)) {
          commitStarted.current = false
          setError(null)
          setStep('kyc')
          return
        }
        setFailed(message)
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
      <ModalHeading>{isBankTransfer ? 'Pay by bank transfer' : 'Pay with card'}</ModalHeading>

      {step === 'init' && (
        <>
          <SkeletonStack>
            <Skeleton $height={16} $width="60%" />
            <Skeleton $height={40} />
            <Skeleton $height={44} $radius={12} />
          </SkeletonStack>
          {error && <ModalBody $error>{error}</ModalBody>}
        </>
      )}

      {step === 'email' && (
        <>
          <EmailField
            value={email}
            onChange={setEmail}
            onSubmit={() => {
              if (isValidEmail(email)) void handleEmailContinue()
            }}
          />
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleEmailContinue} disabled={!isValidEmail(email)} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'register' && (
        <>
          <PhoneField value={phone} onChange={setPhone} defaultCountry={buyerCountry.toLowerCase() as CountryIso2} />
          <LabeledField
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            placeholder={isTestMode ? 'John Verified' : 'Jane Doe'}
            autoComplete="name"
          />
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleRegister} disabled={!phone.trim()} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'kyc' && (
        <>
          <ModalBody>Verify your identity to finish setting up purchases.</ModalBody>
          <LabeledField
            label="First name"
            value={kyc.firstName}
            onChange={setKycField('firstName')}
            type="text"
            placeholder={isTestMode ? 'John' : 'Jane'}
            autoComplete="given-name"
          />
          <LabeledField
            label="Last name"
            value={kyc.lastName}
            onChange={setKycField('lastName')}
            type="text"
            placeholder={isTestMode ? 'Verified' : 'Doe'}
            autoComplete="family-name"
          />
          <LabeledField
            label="Date of birth"
            value={kyc.dob}
            onChange={setKycField('dob')}
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            autoComplete="bday"
          />
          <LabeledField
            label="Street address"
            value={kyc.line1}
            onChange={setKycField('line1')}
            type="text"
            placeholder={isTestMode ? 'address_full_match' : '123 Main St'}
            autoComplete="address-line1"
          />
          <LabeledField
            label="City"
            value={kyc.city}
            onChange={setKycField('city')}
            type="text"
            placeholder="San Francisco"
            autoComplete="address-level2"
          />
          {!isEU && (
            <LabeledField
              label="State"
              value={kyc.state}
              onChange={setKycField('state')}
              type="text"
              placeholder="CA"
              autoComplete="address-level1"
            />
          )}
          <LabeledField
            label={isEU ? 'Postal code' : 'ZIP code'}
            value={kyc.postalCode}
            onChange={setKycField('postalCode')}
            type="text"
            inputMode="numeric"
            placeholder={isEU ? '28001' : '94103'}
            autoComplete="postal-code"
          />
          {isEU ? (
            <LabeledField
              label="City of birth"
              value={kyc.birthCity}
              onChange={setKycField('birthCity')}
              type="text"
              placeholder="Madrid"
            />
          ) : (
            <LabeledField
              label="Social Security number"
              value={kyc.ssn}
              onChange={setKycField('ssn')}
              type="text"
              inputMode="numeric"
              placeholder={isTestMode ? '000000000' : '•••-••-••••'}
            />
          )}
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
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {/* Stripe's elements carry their own headings and copy — nothing is
          repeated above them. A skeleton stands in while the element loads. */}
      {(step === 'auth' || step === 'payment') && (
        <>
          {error && <ErrorText>{error}</ErrorText>}
          {!elementReady && (
            <SkeletonStack>
              <Skeleton $height={18} $width="50%" />
              <Skeleton $height={40} />
              <Skeleton $height={40} $width="70%" />
            </SkeletonStack>
          )}
        </>
      )}
      {/* Stripe's elements mount here (auth OTP + card form). Kept in the tree
          across steps so an element never unmounts mid-callback. */}
      <div ref={elementHostRef} style={{ display: step === 'auth' || step === 'payment' ? 'block' : 'none' }} />
      {step === 'auth' && elementReady && (
        <FooterTextButton>
          <FooterButtonText type="button" onClick={handleChangeEmail}>
            Use a different email
          </FooterButtonText>
        </FooterTextButton>
      )}

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
