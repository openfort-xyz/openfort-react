'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  startOnrampVerification,
  storedOnrampVerification,
  storeOnrampVerification,
  submitOnrampVerification,
} from '../../../hooks/openfort/onrampVerificationsApi'
import { useUser } from '../../../hooks/openfort/useUser'
import { getPublishableKeyEnvironment, isValidEmail } from '../../../utils/validation'
import Button from '../../Common/Button'
import Checkbox from '../../Common/Checkbox'
import LabeledField from '../../Common/LabeledField'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { OtpInputStandalone } from '../../Common/OTPInput'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper } from '../Buy/styles'
import { FooterButtonText, FooterTextButton } from '../EmailOTP/styles'

// US mobile in E.164 — mirrors the server guard (`/^\+1[2-9]\d{9}$/`).
const US_E164 = /^\+1[2-9]\d{9}$/
// Coinbase's sandbox verification numbers (+1000 + 7 digits) — test mode only.
const SANDBOX_E164 = /^\+1000\d{7}$/

const RESEND_COOLDOWN_MS = 10_000

// Coinbase Guest-Checkout requires the buyer to accept these before a native
// wallet-pay order. TODO: confirm the exact required wording/links against
// Coinbase's Guest Checkout integration terms before go-live.
const COINBASE_TERMS_URL = 'https://www.coinbase.com/legal/user_agreement'
const COINBASE_PRIVACY_URL = 'https://www.coinbase.com/legal/privacy'

type Step = 'email' | 'emailCode' | 'phone' | 'phoneCode'

/**
 * Gather + OTP-verify the buyer identity Coinbase's native wallet-pay order
 * needs (email + US phone) using COINBASE-issued OTPs (the Verification API,
 * proxied by the Openfort api), and capture the Guest-Checkout consent on the
 * phone step. Completed verifications are stored for their 60-day validity, so
 * pieces the buyer already verified are skipped — the repeat-buyer fast path is
 * one consent tap. On success it stamps the identity timestamps, attaches both
 * verification ids, and hands off to the commit screen.
 */
const WalletPayContact: React.FC = () => {
  const { setBuyForm, setRoute, triggerResize, publishableKey } = useOpenfort()
  const { user } = useUser()
  // Sandbox destinations (Coinbase test rails) are only meaningful on test keys.
  const isTestMode = getPublishableKeyEnvironment(publishableKey) === 'test'

  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phoneNumber ?? '')
  const [emailVerificationId, setEmailVerificationId] = useState<string | null>(() =>
    user?.email ? storedOnrampVerification('email', user.email) : null
  )
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(() =>
    user?.email && storedOnrampVerification('email', user.email) ? 'phone' : 'email'
  )
  const [consented, setConsented] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [canResend, setCanResend] = useState(true)

  const emailValid = isValidEmail(email)
  const phoneValid = useMemo(() => {
    const trimmed = phone.trim()
    return US_E164.test(trimmed) || (isTestMode && SANDBOX_E164.test(trimmed))
  }, [phone, isTestMode])
  // A stored (60-day) phone verification means no code will be sent — the
  // button completes directly, so it reads "Continue" instead of "Send code".
  const storedSmsId = useMemo(
    () => (phoneValid ? storedOnrampVerification('sms', phone.trim()) : null),
    [phone, phoneValid]
  )

  useEffect(() => {
    triggerResize()
  }, [triggerResize, step, error])

  useEffect(() => {
    if (canResend) return
    const timer = setTimeout(() => setCanResend(true), RESEND_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [canResend])

  const startVerification = async (channel: 'sms' | 'email', destination: string, nextStep?: Step) => {
    setError(null)
    setLoading(true)
    try {
      const started = await startOnrampVerification({ channel, destination, publishableKey })
      setPendingVerificationId(started.verificationId)
      if (nextStep) setStep(nextStep)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmailCode = async () => {
    if (!emailValid) {
      setError('Enter a valid email address.')
      return
    }
    const trimmed = email.trim()
    // Already verified within Coinbase's 60-day window — no code needed.
    const stored = storedOnrampVerification('email', trimmed)
    if (stored) {
      setEmail(trimmed)
      setEmailVerificationId(stored)
      setStep('phone')
      return
    }
    setEmail(trimmed)
    await startVerification('email', trimmed, 'emailCode')
  }

  const handleVerifyEmail = async (otp: string) => {
    if (!pendingVerificationId) return
    setVerifying(true)
    setError(null)
    try {
      const record = await submitOnrampVerification({
        verificationId: pendingVerificationId,
        otpCode: otp,
        publishableKey,
      })
      storeOnrampVerification('email', email, record)
      setEmailVerificationId(record.verificationId)
      setPendingVerificationId(null)
      setStep('phone')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSendPhoneCode = async () => {
    if (!phoneValid) {
      setError(
        isTestMode
          ? 'Enter a US mobile (e.g. +14155550123) or a sandbox number (e.g. +10005550100).'
          : 'Enter a US mobile number, e.g. +14155550123.'
      )
      return
    }
    const trimmed = phone.trim()
    const stored = storedOnrampVerification('sms', trimmed)
    if (stored) {
      completeWith(stored)
      return
    }
    setPhone(trimmed)
    await startVerification('sms', trimmed, 'phoneCode')
  }

  const handleVerifyPhone = async (otp: string) => {
    if (!pendingVerificationId) return
    setVerifying(true)
    setError(null)
    try {
      const record = await submitOnrampVerification({
        verificationId: pendingVerificationId,
        otpCode: otp,
        publishableKey,
      })
      storeOnrampVerification('sms', phone.trim(), record)
      setVerified(true)
      completeWith(record.verificationId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  /** Re-issue the code for the destination the current step is verifying. */
  const handleResend = () => {
    if (!canResend || loading) return
    setCanResend(false)
    if (step === 'emailCode') void startVerification('email', email.trim())
    else void startVerification('sms', phone.trim())
  }

  /** Back to the destination input — for a mistyped email/number. */
  const handleEditDestination = () => {
    setPendingVerificationId(null)
    setError(null)
    setStep(step === 'emailCode' ? 'email' : 'phone')
  }

  /** Assemble the order-ready identity and hand off to the commit screen. */
  const completeWith = (smsVerificationId: string) => {
    const now = new Date().toISOString()
    setBuyForm((prev) => ({
      ...prev,
      walletPay: {
        ...prev.walletPay,
        email: email.trim(),
        phoneNumber: phone.trim(),
        // Coinbase holds the server-side verification record (the id below);
        // the timestamps attest when this widget confirmed identity + consent.
        phoneNumberVerifiedAt: now,
        agreementAcceptedAt: now,
        smsVerificationId,
        ...(emailVerificationId ? { emailVerificationId } : {}),
      },
    }))
    setRoute(routes.BUY_PROCESSING)
  }

  const handleBack = () => setRoute(routes.BUY)

  const resendFooter = (
    <FooterTextButton>
      Didn't receive the code?{' '}
      <FooterButtonText type="button" onClick={handleResend} disabled={!canResend || loading}>
        {loading ? 'Sending…' : canResend ? 'Resend code' : 'Code sent!'}
      </FooterButtonText>
    </FooterTextButton>
  )

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>Verify your details</ModalHeading>

      {step === 'email' && (
        <>
          <ModalBody>Apple Pay and Google Pay purchases need a verified email and phone.</ModalBody>
          <LabeledField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder={isTestMode ? 'you@example.com (sandbox: tester@sandbox.test)' : 'you@example.com'}
            autoComplete="email"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleSendEmailCode} disabled={!emailValid} waiting={loading}>
              Send code
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {step === 'emailCode' && (
        <>
          <ModalBody>
            Enter the code we sent to <b>{email.trim()}</b>.
          </ModalBody>
          <OtpInputStandalone
            onComplete={handleVerifyEmail}
            isLoading={verifying}
            isError={!!error}
            isSuccess={false}
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          {resendFooter}
          <FooterTextButton>
            <FooterButtonText type="button" onClick={handleEditDestination}>
              Use a different email
            </FooterButtonText>
          </FooterTextButton>
        </>
      )}

      {step === 'phone' && (
        <>
          <LabeledField
            label="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder={isTestMode ? '+1 415 555 0123 (sandbox: +10005550100)' : '+1 415 555 0123'}
            autoComplete="tel"
          />
          <ModalBody style={{ marginTop: 14 }}>
            <Checkbox checked={consented} onChange={setConsented}>
              I agree to Coinbase's{' '}
              <a href={COINBASE_TERMS_URL} target="_blank" rel="noopener noreferrer">
                User Agreement
              </a>{' '}
              and{' '}
              <a href={COINBASE_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              , and authorize this purchase.
            </Checkbox>
          </ModalBody>
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button
              variant="primary"
              onClick={handleSendPhoneCode}
              disabled={!phoneValid || !consented}
              waiting={loading}
            >
              {storedSmsId ? 'Continue' : 'Send code'}
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {step === 'phoneCode' && (
        <>
          <ModalBody>
            Enter the code we sent to <b>{phone.trim()}</b>.
          </ModalBody>
          <OtpInputStandalone
            onComplete={handleVerifyPhone}
            isLoading={verifying}
            isError={!!error}
            isSuccess={verified}
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          {resendFooter}
          <FooterTextButton>
            <FooterButtonText type="button" onClick={handleEditDestination}>
              Use a different number
            </FooterButtonText>
          </FooterTextButton>
        </>
      )}
    </PageContent>
  )
}

export default WalletPayContact
