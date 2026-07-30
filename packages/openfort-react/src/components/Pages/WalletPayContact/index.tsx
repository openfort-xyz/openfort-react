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
import Input from '../../Common/Input'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { OtpInputStandalone } from '../../Common/OTPInput'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper } from '../Buy/styles'

// US mobile in E.164 — mirrors the server guard (`/^\+1[2-9]\d{9}$/`).
const US_E164 = /^\+1[2-9]\d{9}$/
// Coinbase's sandbox verification numbers (+1000 + 7 digits) — test mode only.
const SANDBOX_E164 = /^\+1000\d{7}$/

type Step = 'email' | 'emailCode' | 'phone' | 'phoneCode'

/**
 * Gather + OTP-verify the buyer identity Coinbase's native wallet-pay order
 * needs (email + US phone) using COINBASE-issued OTPs (the Verification API,
 * proxied by the Openfort api) — Coinbase sends and checks the codes itself.
 * Completed verifications are stored for their 60-day validity, so pieces the
 * buyer already verified are skipped. Reached from the amount step (which
 * already stamped the Guest-Checkout agreement); on success it stamps
 * phoneNumberVerifiedAt, attaches both verification ids, and hands off to the
 * commit screen.
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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const emailValid = isValidEmail(email)
  const phoneValid = useMemo(() => {
    const trimmed = phone.trim()
    return US_E164.test(trimmed) || (isTestMode && SANDBOX_E164.test(trimmed))
  }, [phone, isTestMode])

  useEffect(() => {
    triggerResize()
  }, [triggerResize, step, error])

  const startVerification = async (channel: 'sms' | 'email', destination: string, nextStep: Step) => {
    setError(null)
    setLoading(true)
    try {
      const started = await startOnrampVerification({ channel, destination, publishableKey })
      setPendingVerificationId(started.verificationId)
      setStep(nextStep)
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

  /** Assemble the order-ready identity and hand off to the commit screen. */
  const completeWith = (smsVerificationId: string) => {
    setBuyForm((prev) => ({
      ...prev,
      walletPay: {
        ...prev.walletPay,
        email: email.trim(),
        phoneNumber: phone.trim(),
        // Coinbase holds the server-side verification record (the id below);
        // the timestamp attests when this widget confirmed it.
        phoneNumberVerifiedAt: new Date().toISOString(),
        smsVerificationId,
        ...(emailVerificationId ? { emailVerificationId } : {}),
      },
    }))
    setRoute(routes.BUY_PROCESSING)
  }

  const handleBack = () => setRoute(routes.BUY)

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>Verify your details</ModalHeading>

      {step === 'email' && (
        <>
          <ModalBody>
            Apple Pay and Google Pay need a verified email and phone. Enter your email — we'll send a code to verify it.
          </ModalBody>
          <Input
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
        </>
      )}

      {step === 'phone' && (
        <>
          <ModalBody>Enter your US mobile number — we'll text a code to verify it.</ModalBody>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder={isTestMode ? '+1 415 555 0123 (sandbox: +10005550100)' : '+1 415 555 0123'}
            autoComplete="tel"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleSendPhoneCode} disabled={!phoneValid} waiting={loading}>
              Send code
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
        </>
      )}
    </PageContent>
  )
}

export default WalletPayContact
