'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  startOnrampVerification,
  storedOnrampVerification,
  storeOnrampVerification,
  submitOnrampVerification,
} from '../../../hooks/openfort/onrampVerificationsApi.js'
import { useFundingClient } from '../../../hooks/openfort/useFunding.js'
import { useUser } from '../../../hooks/openfort/useUser.js'
import styled from '../../../styles/styled/index.js'
import { logger } from '../../../utils/logger.js'
import { getPublishableKeyEnvironment, isValidEmail } from '../../../utils/validation.js'
import Button from '../../Common/Button/index.js'
import Checkbox from '../../Common/Checkbox/index.js'
import EmailField from '../../Common/EmailField/index.js'
import { ErrorText } from '../../Common/ErrorText/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { OtpInputStandalone } from '../../Common/OTPInput/index.js'
import PhoneField from '../../Common/PhoneField/index.js'
import { FundingMethod, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ContinueButtonWrapper } from '../Buy/styles.js'
import { FooterButtonText, FooterTextButton } from '../EmailOTP/styles.js'

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

// Breathing room above and below the code boxes, so the OTP entry reads as
// its own step rather than crowding the copy and footer links.
const OtpSpacing = styled.div`
  margin: 24px 0 16px;
`

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
  const { buyForm, setBuyForm, setRoute, triggerResize, publishableKey } = useOpenfort()
  const { user } = useUser()
  const client = useFundingClient({ useBackendUrl: true })
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: step and error are re-measure triggers, not inputs — each swaps in a differently sized body
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
      void completeWith(stored)
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
      void completeWith(record.verificationId)
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

  /**
   * Where this purchase stands against the buyer's wallet-pay limits. The
   * verified phone is the identity the provider keys them on, so this is the
   * first point the question can be asked — and the last before an order is
   * minted that the limit would refuse.
   *
   * Best-effort: an unreadable limit means "no opinion", never a block. The
   * commit still surfaces a real refusal.
   */
  const limitVerdict = async (verifiedPhone: string): Promise<'ok' | 'upgrade' | string> => {
    if (!client) return 'ok'
    const amount = Number(buyForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) return 'ok'
    const method = buyForm.method === FundingMethod.GOOGLE_PAY ? 'google_pay' : 'apple_pay'
    try {
      const limits = await client.authIntents.limits({ phoneNumber: verifiedPhone, method })
      const overSpend = typeof limits.remainingMinor === 'number' && amount * 100 > limits.remainingMinor
      // null means unlimited here, never "none left".
      const outOfPurchases = limits.remainingTransactions === 0
      if (!overSpend && !outOfPurchases) return 'ok'

      const upgrade = limits.upgrade
      if (upgrade?.available && (upgrade.status === 'unrequested' || upgrade.status === 'resubmit')) return 'upgrade'
      if (upgrade?.status === 'pending') {
        return 'Your limit increase is still under review, so this amount is above what you can buy right now.'
      }
      return overSpend
        ? 'This is more than your current limit allows. Try a smaller amount.'
        : 'You have reached the maximum number of purchases for this payment method.'
    } catch (e) {
      logger.log('[wallet-pay] limits unavailable', e)
      return 'ok'
    }
  }

  /** Assemble the order-ready identity and hand off to the commit screen. */
  const completeWith = async (smsVerificationId: string) => {
    const now = new Date().toISOString()
    const verifiedPhone = phone.trim()
    setBuyForm((prev) => ({
      ...prev,
      walletPay: {
        ...prev.walletPay,
        email: email.trim(),
        phoneNumber: verifiedPhone,
        // Coinbase holds the server-side verification record (the id below);
        // the timestamps attest when this widget confirmed identity + consent.
        phoneNumberVerifiedAt: now,
        agreementAcceptedAt: now,
        smsVerificationId,
        ...(emailVerificationId ? { emailVerificationId } : {}),
      },
    }))
    const verdict = await limitVerdict(verifiedPhone)
    if (verdict === 'upgrade') {
      setRoute(routes.BUY_LIMIT_UPGRADE)
      return
    }
    if (verdict !== 'ok') {
      setError(verdict)
      return
    }
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
          <EmailField
            value={email}
            onChange={setEmail}
            placeholder={isTestMode ? 'Enter your email (sandbox: tester@sandbox.test)' : 'Enter your email'}
            onSubmit={() => {
              if (emailValid) void handleSendEmailCode()
            }}
          />
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleSendEmailCode} disabled={!emailValid} waiting={loading}>
              Send code
            </Button>
          </ContinueButtonWrapper>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'emailCode' && (
        <>
          <ModalBody>
            Enter the code we sent to <b>{email.trim()}</b>.
          </ModalBody>
          <OtpSpacing>
            <OtpInputStandalone
              onComplete={handleVerifyEmail}
              isLoading={verifying}
              isError={!!error}
              isSuccess={false}
            />
          </OtpSpacing>
          {error && <ErrorText>{error}</ErrorText>}
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
          <PhoneField
            value={phone}
            onChange={setPhone}
            countries={['us']}
            defaultCountry="us"
            placeholder={isTestMode ? 'Enter your phone (sandbox: 000 555 0100)' : 'Enter your phone'}
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
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {step === 'phoneCode' && (
        <>
          <ModalBody>
            Enter the code we sent to <b>{phone.trim()}</b>.
          </ModalBody>
          <OtpSpacing>
            <OtpInputStandalone
              onComplete={handleVerifyPhone}
              isLoading={verifying}
              isError={!!error}
              isSuccess={verified}
            />
          </OtpSpacing>
          {error && <ErrorText>{error}</ErrorText>}
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
