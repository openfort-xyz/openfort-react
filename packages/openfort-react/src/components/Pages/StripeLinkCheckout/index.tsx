'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CountryIso2 } from 'react-international-phone'
import Logos from '../../../assets/logos.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import {
  attestationRequired,
  documentsRequired,
  identifierLabel,
  pendingIdentifierTypes,
  type StepUp,
  stepUpFor,
} from '../../../hooks/openfort/euIdentifiers.js'
import type { OnrampIdentity } from '../../../hooks/openfort/fundingClient.js'
import { backendMethodId } from '../../../hooks/openfort/onrampMethodsApi.js'
import {
  createStripeOnrampCoordinator,
  type StripeIdentifierRequirements,
  type StripeKycInfo,
  type StripeOnrampCoordinator,
  stripeNetworkForChain,
} from '../../../hooks/openfort/stripeCryptoOnramp.js'
import { useFundingClient } from '../../../hooks/openfort/useFunding.js'
import { useOnramp } from '../../../hooks/openfort/useOnramp.js'
import { useUser } from '../../../hooks/openfort/useUser.js'
import styled from '../../../styles/styled/index.js'
import { logger } from '../../../utils/logger.js'
import { getPublishableKeyEnvironment, isValidEmail } from '../../../utils/validation.js'
import Button from '../../Common/Button/index.js'
import EmailField from '../../Common/EmailField/index.js'
import { ErrorText } from '../../Common/ErrorText/index.js'
import LabeledField from '../../Common/LabeledField/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import PhoneField from '../../Common/PhoneField/index.js'
import SquircleSpinner from '../../Common/SquircleSpinner/index.js'
import StepProgress from '../../Common/StepProgress/index.js'
import { FundingMethod, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ContinueButtonWrapper, PendingContainer, SpinnerLogoBox } from '../Buy/styles.js'
import { Skeleton, SkeletonStack } from '../Deposit/styles.js'
import { FooterButtonText, FooterTextButton } from '../EmailOTP/styles.js'

/** Two short fields side by side, so a taller input doesn't double the page. */
const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: end;
`

/** The provider's required consent line, sized to sit under a field. */
const ConsentText = styled.div`
  margin: 10px auto 0;
  text-align: center;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ck-body-color-muted, #999999);
`

type Step =
  | 'init' // loading Stripe's script + coordinator
  | 'email' // collect the Link email
  | 'register' // first-time buyer: phone, to create the Link user
  | 'auth' // Stripe's Link authentication element (OTP)
  | 'kyc' // first-time buyer: identity Stripe requires before checkout
  | 'identifiers' // EU: the national identifiers MiCA / CARF require
  | 'attestation' // EU: Stripe's CARF self-declaration element
  | 'documents' // step-up: Stripe's document-verification element
  | 'payment' // Stripe's collectPaymentMethod element
  | 'checkout' // commit + performCheckout + settlement polling

// EU/EEA countries whose addresses make Stripe require birth details and a
// national identifier instead of the US state + SSN pair.
const EU_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK ES'.split(' ')
)

/**
 * Stripe v2 (Link-auth headless) checkout — the `embedded` angle's element
 * flow. The buyer authenticates with Link (register first if new), Stripe's
 * elements collect identity + payment method IN the widget, and the commit
 * creates a headless Stripe session this screen checks out and tracks to
 * settlement. All Stripe UI stays inside the modal; nothing opens a popup.
 */
const StripeLinkCheckout: React.FC = () => {
  const { buyForm, setRoute, triggerResize, publishableKey, uiConfig, mode } = useOpenfort()
  const { user } = useUser()
  const client = useFundingClient({ useBackendUrl: true })
  const embeddedWallet = useEthereumEmbeddedWallet()
  const onramp = useOnramp(buyForm.session, backendMethodId(buyForm.method), { useBackendUrl: true })
  const isTestMode = getPublishableKeyEnvironment(publishableKey) === 'test'
  // Prefer the country the SERVER resolved when it listed the methods — it is
  // the region this purchase actually routes with. The configured country is a
  // fallback, and defaulting to US would show EU buyers the wrong identity form.
  const buyerCountry = buyForm.buyerCountry ?? uiConfig.funding?.country ?? 'US'
  const isEU = EU_COUNTRIES.has(buyerCountry.toUpperCase())
  // The same Link flow serves every rail — only the instrument differs: a US
  // bank account for ACH, a wallet sheet for Apple/Google Pay (both card-backed,
  // so the type stays 'card'), or the card form itself.
  const isBankTransfer = buyForm.method === FundingMethod.BANK_TRANSFER
  const isApplePay = buyForm.method === FundingMethod.APPLE_PAY
  const isGooglePay = buyForm.method === FundingMethod.GOOGLE_PAY

  const [step, setStep] = useState<Step>('init')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // False while a Stripe element is being fetched — the host shows a skeleton
  // placeholder instead of empty space until the element lands.
  const [elementReady, setElementReady] = useState(false)

  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')

  const coordinatorRef = useRef<StripeOnrampCoordinator | null>(null)
  const intentIdRef = useRef<string | null>(null)
  // The provider's own view of this buyer's verification state, read once after
  // auth. Null when the lookup was unavailable — every consumer degrades.
  const identityRef = useRef<OnrampIdentity | null>(null)
  const cryptoCustomerIdRef = useRef<string | null>(null)
  const paymentTokenRef = useRef<string | null>(null)
  const elementHostRef = useRef<HTMLDivElement | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: step and error are re-measure triggers, not inputs — each swaps in a differently sized body
  useEffect(() => {
    triggerResize()
  }, [triggerResize, step, error])

  // Boot the coordinator from the publishable key the method row carried.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the coordinator is created once per mount from the key the method row carried; re-creating it on form or theme changes would tear down live Stripe elements
  useEffect(() => {
    const key = buyForm.stripeLink?.publishableKey
    if (!key || !buyForm.session) {
      setRoute(routes.BUY)
      return
    }
    let cancelled = false
    // Stripe's elements carry their own theme, so a light one inside a dark
    // modal is the only combination that looks broken. 'auto' has to be
    // resolved here: the widget expresses it as a CSS media query, which this
    // cross-origin element can't see.
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    const theme = mode === 'dark' || (mode !== 'light' && prefersDark) ? 'night' : 'stripe'
    createStripeOnrampCoordinator(key, { theme })
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: mountElement and completeAuthentication are plain functions re-created each render that read the latest refs; listing them would re-create this callback every render
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
      // What the provider already holds for this buyer. Best-effort: without it
      // the EU steps fall back to over-asking, which is recoverable; failing the
      // purchase because a status lookup was unavailable is not.
      if (cryptoCustomerIdRef.current) {
        try {
          identityRef.current = await client.authIntents.identity({
            intentId,
            customerRef: cryptoCustomerIdRef.current,
          })
        } catch (e) {
          logger.log('[stripe-link] identity lookup unavailable', e)
        }
      }
      // Register the session's destination wallet with the Link user so the
      // headless session can deliver to it. Best-effort: an already-registered
      // wallet errors harmlessly and the commit surfaces anything real.
      try {
        const full = await client.sessions.get(session.id, { clientSecret: session.clientSecret })
        const network = stripeNetworkForChain(full.target.chain)
        if (network) {
          const wallet = await coordinator.registerWalletAddress(full.target.address, network)
          // EU travel rule: the buyer must prove they control the destination.
          // The destination IS the embedded wallet, so we sign the challenge
          // ourselves — the buyer never sees this step.
          if (isEU && wallet && wallet.verified_ownership !== true) {
            await verifyWalletOwnership(coordinator, full.target.address, network)
          }
        }
      } catch (e) {
        logger.log('[stripe-link] wallet registration skipped', e)
      }
      // A new buyer starts at L0, which collects no identity at all — asking
      // for name, address and date of birth before they have exceeded anything
      // is the provider's step-up form shown a tier too early. Only an amount
      // over their limit calls for it, and if the provider disagrees the commit
      // rejects with "identity verification required" and routes here anyway.
      const stepUp = await overLimitStepUp(intentId)
      if (stepUp && 'blocked' in stepUp) {
        // Nothing on this screen raises the ceiling, so end the attempt with the
        // reason — "Try again" returns to the amount, which is the actual fix.
        setFailed(stepUp.blocked)
        return
      }
      setStep(stepUp?.step ?? 'payment')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link authentication could not be completed.')
      setStep('email')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Answer Stripe's wallet-ownership challenge by signing it with the embedded
   * wallet that is the destination. Integrators whose destination is an
   * external wallet have to send the buyer away to sign; here the signer is
   * ours, so the travel rule costs the buyer nothing.
   *
   * Best-effort by design: if Stripe genuinely requires the proof, the commit
   * fails with its own message — better than blocking a buyer here over a
   * signature Stripe might not have asked for.
   */
  const verifyWalletOwnership = async (
    coordinator: StripeOnrampCoordinator,
    walletAddress: string,
    network: string
  ) => {
    try {
      const challenge = await coordinator.getWalletOwnershipChallenge({ walletAddress, network })
      const provider = await embeddedWallet.activeWallet?.getProvider()
      if (!provider) {
        logger.log('[stripe-link] no embedded provider to sign the ownership challenge')
        return
      }
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [challenge.message, walletAddress],
      })) as string
      await coordinator.submitWalletOwnershipSignature({ challengeId: challenge.challengeId, signature })
      logger.log('[stripe-link] wallet ownership verified')
    } catch (e) {
      logger.log('[stripe-link] wallet ownership verification skipped', e)
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
      await coordinator.registerLinkUser(email.trim(), phone.trim(), buyerCountry)
      await startAuthentication(email.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the Link account.')
    } finally {
      setLoading(false)
    }
  }

  // ---- EU national identifiers (MiCA / CARF) ----
  // The types Stripe is still waiting for, and what the buyer has typed for
  // each. `carfType` is separate because carf_tin_required names no type — the
  // buyer's country decides which tax number to ask for.
  const [identifierTypes, setIdentifierTypes] = useState<string[]>([])
  const [identifierValues, setIdentifierValues] = useState<Record<string, string>>({})

  /**
   * Whether this purchase exceeds what the buyer's current tier allows, so the
   * document step-up should run before payment rather than letting the commit
   * fail with the provider's own limit error.
   *
   * Best-effort: an unavailable or unparseable limit means "no opinion", never
   * a block. Provider amounts are in CENTS.
   */
  const overLimitStepUp = async (intentId: string): Promise<StepUp | null> => {
    if (!client) return null
    const amount = Number(buyForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null
    try {
      const { limits } = await client.authIntents.limits({ intentId })
      // The provider's own field name here is unconfirmed against live data, so
      // a miss reads as "no opinion" and the commit keeps the final say. Pin the
      // name once a real EU run shows the payload.
      const maximum = limits?.maximum
      if (typeof maximum !== 'number' || amount * 100 <= maximum) return null
      return stepUpFor(identityRef.current?.level)
    } catch (e) {
      logger.log('[stripe-link] transaction limits unavailable', e)
      return null
    }
  }

  /**
   * The remaining identity steps once identifiers are settled, in the order
   * Stripe wants them. Returns true when one of them took over the flow.
   */
  const advancePastIdentifiers = (requirements: StripeIdentifierRequirements): boolean => {
    const identity = identityRef.current
    if (attestationRequired(requirements, identity?.providedFields)) {
      setStep('attestation')
      return true
    }
    if (documentsRequired(identity?.level, identity?.providedFields)) {
      setStep('documents')
      return true
    }
    return false
  }

  /**
   * Ask Stripe what identifiers are outstanding and, if any are, show the form.
   * Returns true when it took over the flow, so callers stop advancing.
   */
  const enterIdentifiersIfRequired = async (coordinator: StripeOnrampCoordinator): Promise<boolean> => {
    let requirements: StripeIdentifierRequirements
    try {
      requirements = await coordinator.getMissingIdentifiers()
    } catch (e) {
      // An account without the identifier feature answers with an error rather
      // than an empty list; that buyer simply owes nothing.
      logger.log('[stripe-link] identifier requirements unavailable', e)
      return false
    }
    const types = pendingIdentifierTypes(requirements, buyerCountry)
    if (types.length === 0) {
      // Nothing to type in, but the declaration or documents may still be due.
      return advancePastIdentifiers(requirements)
    }
    setIdentifierTypes(types)
    setIdentifierValues({})
    setStep('identifiers')
    return true
  }

  const handleIdentifiersSubmit = async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) {
      setError('The Stripe checkout is no longer active — close and reopen the purchase.')
      return
    }
    const identifiers = identifierTypes
      .map((type) => ({ type, value: identifierValues[type]?.trim() ?? '' }))
      .filter((i) => i.value.length > 0)
    if (identifiers.length !== identifierTypes.length) {
      setError('Fill in every identifier to continue.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await coordinator.updateKycInfo(identifiers)
      if (result.invalid_identifiers.length > 0) {
        const names = result.invalid_identifiers.map(identifierLabel).join(', ')
        setIdentifierTypes(pendingIdentifierTypes(result, buyerCountry))
        setError(`Check these and try again: ${names}.`)
        return
      }
      if (!result.completed) {
        // Satisfying one requirement can reveal another (Stripe re-evaluates
        // alternatives as values land) — stay on the form with the new list.
        const next = pendingIdentifierTypes(result, buyerCountry)
        if (next.length > 0) {
          setIdentifierTypes(next)
          setIdentifierValues({})
          return
        }
      }
      if (advancePastIdentifiers(result)) return
      if (paymentTokenRef.current) {
        commitStarted.current = false
        setStep('checkout')
      } else {
        setStep('payment')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those identifiers could not be verified.')
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
    // Default to the address country: the common case, and both are required
    // for an EU buyer, so a prefilled field is one less thing to type.
    birthCountry: buyerCountry,
    nationality: buyerCountry,
  })
  const setKycField = (field: keyof typeof kyc) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setKyc((prev) => ({ ...prev, [field]: e.target.value }))

  // The identity form is long enough that facing it whole reads as a wall, so
  // it runs as two pages: who you are, then where you live.
  const [kycPage, setKycPage] = useState<0 | 1>(0)
  const identityPageComplete =
    Boolean(kyc.firstName.trim() && kyc.lastName.trim() && kyc.dob.trim()) &&
    (!isEU || Boolean(kyc.birthCity.trim() && kyc.birthCountry.trim() && kyc.nationality.trim()))
  const addressPageComplete = Boolean(kyc.line1.trim() && kyc.city.trim() && kyc.postalCode.trim())

  const handleKycSubmit = async () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) {
      setError('The Stripe checkout is no longer active — close and reopen the purchase.')
      return
    }
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
        ? {
            birth_city: kyc.birthCity.trim(),
            // Neither of these can be assumed from the address — someone living
            // in Spain may hold another nationality and have been born
            // elsewhere. Stripe rejects an EU submission that omits them.
            birth_country: kyc.birthCountry.trim().toUpperCase(),
            nationalities: [kyc.nationality.trim().toUpperCase()],
          }
        : kyc.ssn.trim()
          ? { id_number: { type: 'us_ssn' as const, value: kyc.ssn.replace(/\D/g, '') } }
          : {}),
    }
    setError(null)
    setLoading(true)
    try {
      await coordinator.submitKycInfo(info)
      // EU buyers owe national identifiers on top of the basic details; Stripe
      // itself says which, so ask before assuming identity is complete.
      if (isEU && (await enterIdentifiersIfRequired(coordinator))) return
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

  // ---- CARF attestation element ----
  const attestationMounted = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when `step` enters this phase (guarded by the mounted ref); the other values are read from refs at that moment and must not re-trigger the mount
  useEffect(() => {
    const coordinator = coordinatorRef.current
    if (step !== 'attestation' || !coordinator || attestationMounted.current) return
    attestationMounted.current = true
    setElementReady(false)
    coordinator
      .promptUserAttestation('eu_carf', (result) => {
        if (result.result !== 'confirmed') {
          // Abandoning is a decision, not a failure — the purchase simply can't
          // proceed without the declaration.
          setError('The declaration is required before you can continue.')
          return
        }
        if (paymentTokenRef.current) {
          commitStarted.current = false
          setStep('checkout')
        } else {
          setStep('payment')
        }
      })
      .then(mountElement)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load the declaration.')
      })
  }, [step])

  // ---- Document verification (step-up) ----
  // Unlike the other elements this one resolves rather than calling back, and
  // Stripe reviews the documents afterwards — a submitted buyer is 'pending',
  // not verified, so the purchase continues and the commit decides.
  const documentsMounted = useRef(false)
  useEffect(() => {
    const coordinator = coordinatorRef.current
    if (step !== 'documents' || !coordinator || documentsMounted.current) return
    documentsMounted.current = true
    setElementReady(false)
    coordinator
      .verifyDocuments()
      .then((result) => {
        if (result.result !== 'success') {
          setError('Identity documents are required before you can continue.')
          return
        }
        if (paymentTokenRef.current) {
          commitStarted.current = false
          setStep('checkout')
        } else {
          setStep('payment')
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not start document verification.')
      })
  }, [step])

  // ---- Payment collection element ----
  const paymentMounted = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when `step` enters this phase (guarded by the mounted ref); the other values are read from refs at that moment and must not re-trigger the mount
  useEffect(() => {
    const coordinator = coordinatorRef.current
    if (step !== 'payment' || !coordinator || paymentMounted.current) return
    paymentMounted.current = true
    setElementReady(false)
    coordinator
      .collectPaymentMethod(
        {
          payment_method_types: [isBankTransfer ? 'us_bank_account' : 'card'],
          // Offer the sheet the buyer actually picked. Leaving both 'never' —
          // as this did — handed anyone who chose Apple or Google Pay a plain
          // card form with their wallet explicitly switched off.
          wallets: {
            applePay: isApplePay ? 'always' : 'never',
            googlePay: isGooglePay ? 'always' : 'never',
          },
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
  }, [step])

  // An existing-but-unverified Link buyer fails at payment-token creation, and
  // Stripe's element surfaces that as an unhandled rejection — outside both the
  // mount promise and the completion callback. Catch it while the payment step
  // is up and collect identity, mirroring the commit-stage recovery below.
  useEffect(() => {
    if (step !== 'payment') return
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
      if (!/identity verification/i.test(message)) return
      event.preventDefault()
      paymentMounted.current = false
      setError(null)
      setKycPage(0)
      setStep('kyc')
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [step])

  // ---- Commit + checkout + settlement ----
  const [failed, setFailed] = useState<string | null>(null)
  const commitStarted = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when `step` enters checkout (guarded by commitStarted); the order form and identity refs are read at that moment and must not re-trigger the commit
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
          setKycPage(0)
          setStep('kyc')
          return
        }
        // The L2 tier: the buyer outgrew L1 (amount or accumulated purchases)
        // and Stripe wants documents — mount its capture element and retry.
        if (/document verification/i.test(message)) {
          commitStarted.current = false
          setError(null)
          setStep('documents')
          return
        }
        setFailed(message)
      })
  }, [step])

  // Once the commit lands, drive Stripe's headless checkout: performCheckout
  // redeems our one-shot element secret (mandate acceptance happens server-side
  // on that call). Session polling above remains the settlement source of truth.
  const checkoutStarted = useRef(false)
  const committedPm = onramp.session?.paymentMethod
  const providerSessionId = committedPm?.type === 'onramp' ? (committedPm.providerSessionId ?? null) : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when the provider session id lands (guarded by checkoutStarted); the client and session are read at that moment and must not re-trigger the checkout
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
  }, [providerSessionId])

  /**
   * The step to retrace to. Only steps whose predecessor is one of OUR forms
   * appear here — anything past a provider handoff (auth, attestation,
   * documents, payment) leaves the flow instead, because the buyer has already
   * given that work to Stripe and re-showing it would either strand it or
   * force a needless re-authentication. Leaving lands on the amount screen,
   * which is what someone backing out of a payment usually wants to change.
   */
  const previousStep: Partial<Record<Step, Step>> = {
    register: 'email',
    identifiers: 'kyc',
  }

  const handleBack = () => {
    // Inside the identity form, back belongs to its own pages first.
    if (step === 'kyc' && kycPage === 1) {
      setKycPage(0)
      return
    }
    const previous = previousStep[step]
    if (previous) {
      setError(null)
      setStep(previous)
      return
    }
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
            <Skeleton $h="16px" $w="60%" />
            <Skeleton $h="40px" />
            <Skeleton $h="44px" $r="12px" />
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
          {/* The name is collected on the identity step, where it is actually
              required — asking here made the phone screen look like a form. */}
          <ConsentText>By continuing, you agree to the Link crypto onramp terms and privacy policy.</ConsentText>
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleRegister} disabled={!phone.trim()} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'identifiers' && (
        <>
          <ModalBody>Your country requires these details before you can buy crypto.</ModalBody>
          {identifierTypes.map((type) => (
            <LabeledField
              large
              key={type}
              label={identifierLabel(type)}
              value={identifierValues[type] ?? ''}
              onChange={(e) => setIdentifierValues((prev) => ({ ...prev, [type]: e.target.value }))}
              type="text"
            />
          ))}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleIdentifiersSubmit} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'attestation' && (
        <>
          <ModalBody>One last declaration before you pay.</ModalBody>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'documents' && (
        <>
          <ModalBody>Confirm your identity to raise your purchase limit.</ModalBody>
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
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'kyc' && kycPage === 0 && (
        <>
          <StepProgress current={1} total={2} />
          <ModalBody>Verify your identity to finish setting up purchases.</ModalBody>
          <LabeledField
            large
            label="First name"
            value={kyc.firstName}
            onChange={setKycField('firstName')}
            type="text"
            placeholder={isTestMode ? 'John' : 'Jane'}
            autoComplete="given-name"
          />
          <LabeledField
            large
            label="Last name"
            value={kyc.lastName}
            onChange={setKycField('lastName')}
            type="text"
            placeholder={isTestMode ? 'Verified' : 'Doe'}
            autoComplete="family-name"
          />
          <LabeledField
            large
            label="Date of birth"
            value={kyc.dob}
            onChange={setKycField('dob')}
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            autoComplete="bday"
          />
          {isEU ? (
            <FieldRow>
              <LabeledField
                large
                label="City of birth"
                value={kyc.birthCity}
                onChange={setKycField('birthCity')}
                type="text"
                placeholder="Madrid"
              />
              <LabeledField
                large
                label="Country of birth"
                value={kyc.birthCountry}
                onChange={setKycField('birthCountry')}
                type="text"
                placeholder="ES"
                autoComplete="country"
              />
            </FieldRow>
          ) : (
            <LabeledField
              large
              label="Social Security number"
              value={kyc.ssn}
              onChange={setKycField('ssn')}
              type="text"
              inputMode="numeric"
              placeholder={isTestMode ? '000000000' : '\u2022\u2022\u2022-\u2022\u2022-\u2022\u2022\u2022\u2022'}
            />
          )}
          {isEU && (
            <LabeledField
              large
              label="Nationality"
              value={kyc.nationality}
              onChange={setKycField('nationality')}
              type="text"
              placeholder="ES"
            />
          )}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={() => setKycPage(1)} disabled={!identityPageComplete}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'kyc' && kycPage === 1 && (
        <>
          <StepProgress current={2} total={2} />
          <ModalBody>Where do you live?</ModalBody>
          <LabeledField
            large
            label="Street address"
            value={kyc.line1}
            onChange={setKycField('line1')}
            type="text"
            placeholder={isTestMode ? 'address_full_match' : '123 Main St'}
            autoComplete="address-line1"
          />
          <FieldRow>
            <LabeledField
              large
              label="City"
              value={kyc.city}
              onChange={setKycField('city')}
              type="text"
              placeholder="San Francisco"
              autoComplete="address-level2"
            />
            <LabeledField
              large
              label={isEU ? 'Postal code' : 'ZIP code'}
              value={kyc.postalCode}
              onChange={setKycField('postalCode')}
              type="text"
              autoComplete="postal-code"
            />
          </FieldRow>
          {!isEU && (
            <LabeledField
              large
              label="State"
              value={kyc.state}
              onChange={setKycField('state')}
              type="text"
              placeholder="CA"
              autoComplete="address-level1"
            />
          )}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleKycSubmit} disabled={!addressPageComplete} waiting={loading}>
              Continue
            </Button>
          </ContinueButtonWrapper>
          <FooterTextButton
            onClick={() => {
              // Going back mid-submit would strand the in-flight request.
              if (!loading) setKycPage(0)
            }}
          >
            <FooterButtonText>Back</FooterButtonText>
          </FooterTextButton>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {/* Stripe's elements carry their own headings and copy — nothing is
          repeated above them. A skeleton stands in while the element loads. */}
      {(step === 'auth' || step === 'payment' || step === 'attestation') && (
        <>
          {error && <ErrorText>{error}</ErrorText>}
          {!elementReady && (
            <SkeletonStack>
              <Skeleton $h="18px" $w="50%" />
              <Skeleton $h="40px" />
              <Skeleton $h="40px" $w="70%" />
            </SkeletonStack>
          )}
        </>
      )}
      {/* Stripe's elements mount here (auth OTP + card form). Kept in the tree
          across steps so an element never unmounts mid-callback. */}
      <div
        ref={elementHostRef}
        style={{ display: step === 'auth' || step === 'payment' || step === 'attestation' ? 'block' : 'none' }}
      />
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
                <SpinnerLogoBox>
                  <Logos.Openfort />
                </SpinnerLogoBox>
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
