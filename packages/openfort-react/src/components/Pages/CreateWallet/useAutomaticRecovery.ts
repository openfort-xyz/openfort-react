'use client'

import { RecoveryMethod } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OpenfortError } from '../../../errors/base.js'
import type { WalletChain } from '../../../errors/wallet.js'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP.js'
import { useRecoveryOTP } from '../../../shared/hooks/useRecoveryOTP.js'
import type { CreateEmbeddedWalletOptions } from '../../../shared/types.js'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError.js'
import { logger } from '../../../utils/logger.js'
import type { SetRouteOptions } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'

type OtpStatus = 'idle' | 'loading' | 'error' | 'success' | 'sending-otp' | 'send-otp'

/** How long a failure message stays up before the code input reopens. */
const ERROR_DISPLAY_DURATION_MS = 1000

type AutomaticRecoveryOptions = {
  /** Chain family this flow creates a wallet on, used to label the debug logs. */
  chain: WalletChain
  /** Chain-specific embedded wallet creation call. */
  create: (options?: CreateEmbeddedWalletOptions) => Promise<unknown>
  /** Route to move to once the wallet exists. */
  successRoute: SetRouteOptions
  /** Copy shown when a submitted code is rejected without a typed Openfort error. */
  otpVerificationError: string
  /** Blocks creation while a competing SDK operation is in flight. */
  canCreate: boolean
}

export type AutomaticRecovery = {
  /** Failure that stopped the flow, rendered by the caller's loader. */
  recoveryError: Error | null
  /** A creation attempt has been requested and has not run yet. */
  shouldCreate: boolean
  /** A creation attempt is in flight. */
  isCreating: boolean
  /** The recovery share is gated behind a code the user has to type. */
  needsOTP: boolean
  /** Where the code was sent, once one has been requested. */
  otpResponse: OTPResponse | null
  otpStatus: OtpStatus
  /** Copy for a rejected code, shown under the input. */
  otpError: string | false
  submitOtp: (otp: string) => Promise<void>
  resend: { onClick: () => void; disabled: boolean; label: string }
  /** Requests a creation attempt, clearing any previous failure. */
  startCreation: () => void
}

/**
 * Drives automatic wallet recovery: it creates the embedded wallet, turns the
 * `OTP_REQUIRED` outcome into a one-time-code request, and verifies the code the
 * user types by retrying creation with it.
 */
export function useAutomaticRecovery({
  chain,
  create,
  successRoute,
  otpVerificationError,
  canCreate,
}: AutomaticRecoveryOptions): AutomaticRecovery {
  const { setRoute, triggerResize } = useOpenfort()
  const { isEnabled: isWalletRecoveryOTPEnabled, requestOTP } = useRecoveryOTP()

  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const [shouldCreate, setShouldCreate] = useState(false)
  const [needsOTP, setNeedsOTP] = useState(false)
  const [otpResponse, setOtpResponse] = useState<OTPResponse | null>(null)
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle')
  const [otpError, setOtpError] = useState<false | string>(false)
  const [canSendOtp, setCanSendOtp] = useState(true)
  const isCreatingRef = useRef(false)

  const submitOtp = useCallback(
    async (otp: string) => {
      setOtpStatus('loading')
      try {
        await create({ recoveryMethod: RecoveryMethod.AUTOMATIC, otpCode: otp })
        setOtpStatus('success')
        setRoute(successRoute)
      } catch (err) {
        setOtpStatus('error')
        setOtpError(err instanceof OpenfortError ? err.message : otpVerificationError)
        logger.log('Error verifying OTP for wallet recovery', err)
      }
    },
    [create, setRoute, successRoute, otpVerificationError]
  )

  useEffect(() => {
    if (!shouldCreate) return
    if (isCreatingRef.current) return
    // Wait for the state machine's account fetch to finish before calling
    // create() — concurrent SDK operations corrupt shared state.
    if (!canCreate) return
    isCreatingRef.current = true
    ;(async () => {
      logger.log('Creating wallet with automatic recovery', { chain })
      try {
        await create({ recoveryMethod: RecoveryMethod.AUTOMATIC })
        setShouldCreate(false)
        setRoute(successRoute)
      } catch (err) {
        setShouldCreate(false)
        const { error, isOTPRequired } = handleOtpRecoveryError(err, isWalletRecoveryOTPEnabled)
        if (isOTPRequired && isWalletRecoveryOTPEnabled) {
          try {
            const response = await requestOTP()
            setNeedsOTP(true)
            setOtpResponse(response)
          } catch (otpErr) {
            logger.log('Error requesting OTP for wallet recovery', otpErr)
            setRecoveryError(new Error('Failed to send recovery code'))
          }
        } else {
          logger.log('Error creating wallet', err)
          setRecoveryError(error)
        }
      } finally {
        isCreatingRef.current = false
      }
      triggerResize()
    })()
  }, [
    shouldCreate,
    canCreate,
    chain,
    create,
    successRoute,
    isWalletRecoveryOTPEnabled,
    requestOTP,
    triggerResize,
    setRoute,
  ])

  // The resend button parks its request in the status as `send-otp`; this effect
  // performs the request and reports the outcome back through the same status.
  useEffect(() => {
    if (otpStatus !== 'send-otp') return
    setOtpStatus('sending-otp')
    ;(async () => {
      try {
        setOtpResponse(await requestOTP())
        setOtpStatus('idle')
      } catch (err) {
        logger.log('Error requesting OTP for wallet recovery', err)
        setOtpError('Failed to send recovery code')
        setOtpStatus('error')
      }
    })()
  }, [otpStatus, requestOTP])

  // A failure message stays up long enough to be read, then the input reopens.
  useEffect(() => {
    if (otpStatus !== 'error') return
    const timerId = setTimeout(() => {
      setOtpStatus('idle')
      setOtpError(false)
    }, ERROR_DISPLAY_DURATION_MS)
    return () => clearTimeout(timerId)
  }, [otpStatus])

  const startCreation = useCallback(() => {
    setRecoveryError(null)
    setShouldCreate(true)
  }, [])

  const onResendClick = useCallback(() => {
    setOtpStatus('send-otp')
    setCanSendOtp(false)
  }, [])

  const resendLabel = useMemo(() => {
    if (!canSendOtp) return 'Code Sent!'
    if (otpStatus === 'sending-otp') return 'Sending...'
    return 'Resend Code'
  }, [canSendOtp, otpStatus])

  return {
    recoveryError,
    shouldCreate,
    isCreating: isCreatingRef.current,
    needsOTP: needsOTP && isWalletRecoveryOTPEnabled,
    otpResponse,
    otpStatus,
    otpError,
    submitOtp,
    resend: {
      onClick: onResendClick,
      disabled: !canSendOtp || otpStatus === 'sending-otp' || otpStatus === 'send-otp',
      label: resendLabel,
    },
    startCreation,
  }
}
