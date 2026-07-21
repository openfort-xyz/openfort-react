'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useEmailOtpAuth } from '../../../hooks/openfort/auth/useEmailOtpAuth'
import { usePhoneOtpAuth } from '../../../hooks/openfort/auth/usePhoneOtpAuth'
import { useUser } from '../../../hooks/openfort/useUser'
import { isValidEmail } from '../../../utils/validation'
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

type Step = 'email' | 'emailCode' | 'phone' | 'code'

/**
 * Gather + OTP-verify the buyer identity Coinbase's native wallet-pay order
 * needs (email + US phone), reusing Openfort's OWN email and phone OTP. Reached
 * from the amount step (which already stamped the Guest-Checkout agreement) only
 * when the user's existing identity is incomplete; each half is skipped when the
 * auth session already collected it. On success it stamps phoneNumberVerifiedAt
 * and hands off to the commit screen.
 */
const WalletPayContact: React.FC = () => {
  const { setBuyForm, setRoute, triggerResize } = useOpenfort()
  const { user } = useUser()
  const { requestPhoneOtp, linkPhoneOtp, isLoading } = usePhoneOtpAuth({ recoverWalletAutomatically: false })
  const {
    requestEmailOtp,
    verifyEmailOtp,
    isRequesting: emailRequesting,
    isLoading: emailVerifying,
  } = useEmailOtpAuth({ recoverWalletAutomatically: false })

  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phoneNumber ?? '')
  const [step, setStep] = useState<Step>(() => (user?.email ? 'phone' : 'email'))
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const emailValid = isValidEmail(email)
  const phoneValid = useMemo(() => US_E164.test(phone.trim()), [phone])

  useEffect(() => {
    triggerResize()
  }, [triggerResize, step, error])

  const handleSendEmailCode = async () => {
    if (!emailValid) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    const { error: reqError } = await requestEmailOtp({ email: email.trim() })
    if (reqError) {
      setError('Could not send the code. Check the address and try again.')
      return
    }
    setStep('emailCode')
  }

  const handleVerifyEmail = async (otp: string) => {
    setVerifying(true)
    setError(null)
    const { error: verifyError } = await verifyEmailOtp({ email: email.trim(), otp })
    setVerifying(false)
    if (verifyError) {
      setError('Invalid code. Please try again.')
      return
    }
    // Phone was already collected + verified through auth — the identity is now
    // complete, so hand off without re-verifying it (mirrors the amount step's
    // skip path, including its client-side verifiedAt stamp).
    if (user?.phoneNumber && user.phoneNumberVerified) {
      setVerified(true)
      const phoneNumber = user.phoneNumber
      setBuyForm((prev) => ({
        ...prev,
        walletPay: {
          ...prev.walletPay,
          email: email.trim(),
          phoneNumber,
          phoneNumberVerifiedAt: new Date().toISOString(),
        },
      }))
      setRoute(routes.BUY_PROCESSING)
      return
    }
    setStep('phone')
  }

  const handleSendCode = async () => {
    if (!phoneValid) {
      setError('Enter a US mobile number, e.g. +14155550123.')
      return
    }
    setError(null)
    const { error: reqError } = await requestPhoneOtp({ phoneNumber: phone.trim() })
    if (reqError) {
      setError('Could not send the code. Check the number and try again.')
      return
    }
    setStep('code')
  }

  const handleVerify = async (otp: string) => {
    setVerifying(true)
    setError(null)
    // The buyer is already authenticated (they're funding their wallet), so this
    // LINKS + verifies the phone on their account rather than logging in.
    const { error: verifyError } = await linkPhoneOtp({ phoneNumber: phone.trim(), otp })
    if (verifyError) {
      setVerifying(false)
      setError(
        verifyError.message === 'Invalid OTP' ? 'Invalid code. Please try again.' : 'Verification failed. Try again.'
      )
      return
    }
    setVerified(true)
    // No server 'verifiedAt' exists — stamp it the instant verification succeeds.
    setBuyForm((prev) => ({
      ...prev,
      walletPay: {
        ...prev.walletPay,
        email: email.trim(),
        phoneNumber: phone.trim(),
        phoneNumberVerifiedAt: new Date().toISOString(),
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
            placeholder="you@example.com"
            autoComplete="email"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleSendEmailCode} disabled={!emailValid} waiting={emailRequesting}>
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
            isLoading={verifying || emailVerifying}
            isError={!!error}
            isSuccess={verified}
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
            placeholder="+1 415 555 0123"
            autoComplete="tel"
          />
          {error && <ModalBody $error>{error}</ModalBody>}
          <ContinueButtonWrapper>
            <Button variant="primary" onClick={handleSendCode} disabled={!phoneValid} waiting={isLoading}>
              Send code
            </Button>
          </ContinueButtonWrapper>
        </>
      )}

      {step === 'code' && (
        <>
          <ModalBody>
            Enter the code we sent to <b>{phone}</b>.
          </ModalBody>
          <OtpInputStandalone
            onComplete={handleVerify}
            isLoading={verifying || isLoading}
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
