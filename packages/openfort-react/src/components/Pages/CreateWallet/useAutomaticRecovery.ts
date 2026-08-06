'use client'

import { RecoveryMethod } from '@openfort/openfort-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthenticationError } from '../../../errors/auth.js'
import { OpenfortError } from '../../../errors/base.js'
import type { WalletChain } from '../../../errors/wallet.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP.js'
import { OTP_ERROR_DISPLAY_MS, OTP_RESEND_COOLDOWN_MS, useRecoveryOTP } from '../../../shared/hooks/useRecoveryOTP.js'
import type { CreateEmbeddedWalletOptions, CreateEmbeddedWalletResult } from '../../../shared/types.js'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError.js'
import {
  clearPersistentOperation,
  getOrCreatePersistentOperation,
  getPersistentOperation,
  hasPersistentOperation,
  PersistentOperationLaneBusyError,
} from '../../../shared/utils/persistentOperationRegistry.js'
import { logger } from '../../../utils/logger.js'
import { usePageActivity } from '../../Common/Modal/pageActivity.js'
import type { SetRouteOptions } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'

type OtpStatus = 'idle' | 'loading' | 'error' | 'success'

type CreationOutcome =
  | { status: 'success' }
  | { status: 'otp-required'; response: OTPResponse }
  | { status: 'error'; error: Error }

type OtpOperation =
  | { kind: 'verify'; promise: Promise<{ error?: unknown }>; isCurrent: () => boolean }
  | { kind: 'resend'; promise: Promise<OTPResponse>; isCurrent: () => boolean }

type AutomaticRecoveryOptions = {
  /** Chain family this flow creates a wallet on, used to label the debug logs. */
  chain: WalletChain
  /** Chain-specific embedded wallet creation call. */
  create: (options?: CreateEmbeddedWalletOptions) => Promise<CreateEmbeddedWalletResult>
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
  /** A creation attempt has been requested or is in flight. */
  shouldCreate: boolean
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
  const pageActive = usePageActivity()
  const { setRoute, triggerResize } = useOpenfort()
  const { isEnabled: isWalletRecoveryOTPEnabled, requestOTP } = useRecoveryOTP()
  const client = useOpenfortCore((state) => state.client)
  const { captureAuthSession } = useAuthTransitions()
  const operationLane = `wallet-create:${chain}`
  const operationPrefix = `${operationLane}:automatic`
  const creationOperationKey = `${operationPrefix}:initial`
  const verificationOperationKey = `${operationPrefix}:verify`
  const resendOperationKey = `${operationPrefix}:resend`

  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const [shouldCreate, setShouldCreate] = useState(false)
  // A code has been requested exactly when there is somewhere to have sent it,
  // so the response doubles as the "needs a code" flag.
  const [otpResponse, setOtpResponse] = useState<OTPResponse | null>(null)
  const [otp, setOtp] = useState<{ status: OtpStatus; error: false | string }>({ status: 'idle', error: false })
  const [canSendOtp, setCanSendOtp] = useState(true)
  const operationVersionRef = useRef(0)
  const mountedRef = useRef(true)
  const pageActiveRef = useRef(pageActive)
  const otpOperationRef = useRef<number | null>(null)
  const otpOperationSequenceRef = useRef(0)
  const pendingOtpOperationRef = useRef<OtpOperation | null>(null)
  const operationScopeRef = useRef({
    chain,
    create,
    successRoute,
    otpVerificationError,
    isWalletRecoveryOTPEnabled,
    requestOTP,
    setRoute,
    triggerResize,
  })
  operationScopeRef.current = {
    chain,
    create,
    successRoute,
    otpVerificationError,
    isWalletRecoveryOTPEnabled,
    requestOTP,
    setRoute,
    triggerResize,
  }

  if (pageActiveRef.current !== pageActive) {
    pageActiveRef.current = pageActive
    operationVersionRef.current += 1
  }

  const isCurrentOperation = useCallback(
    (version: number) => mountedRef.current && pageActiveRef.current && operationVersionRef.current === version,
    []
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationVersionRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (pageActive) return
    otpOperationRef.current = null
    setOtp((current) => (current.status === 'loading' ? { status: 'idle', error: false } : current))
  }, [pageActive])

  const observeOtpOperation = useCallback(
    async (operation: OtpOperation) => {
      if (!pageActiveRef.current || otpOperationRef.current !== null) return
      const otpOperation = ++otpOperationSequenceRef.current
      otpOperationRef.current = otpOperation
      const operationVersion = ++operationVersionRef.current
      const scope = operationScopeRef.current
      setOtp({ status: 'loading', error: false })
      try {
        if (operation.kind === 'verify') {
          const result = await operation.promise
          if (!operation.isCurrent() || !isCurrentOperation(operationVersion)) return
          pendingOtpOperationRef.current = null
          if (result.error) throw result.error
          clearPersistentOperation(client, verificationOperationKey)
          clearPersistentOperation(client, creationOperationKey)
          setOtp({ status: 'success', error: false })
          scope.setRoute(scope.successRoute)
        } else {
          const response = await operation.promise
          if (!operation.isCurrent() || !isCurrentOperation(operationVersion)) return
          pendingOtpOperationRef.current = null
          clearPersistentOperation(client, resendOperationKey)
          setOtpResponse(response)
          setOtp({ status: 'idle', error: false })
        }
      } catch (err) {
        if (
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentOperation(operationVersion)
        )
          return
        pendingOtpOperationRef.current = null
        clearPersistentOperation(client, operation.kind === 'verify' ? verificationOperationKey : resendOperationKey)
        const fallback = operation.kind === 'verify' ? scope.otpVerificationError : 'Failed to send recovery code'
        setOtp({ status: 'error', error: err instanceof OpenfortError ? err.message : fallback })
        logger.log(operation.kind === 'verify' ? 'Error verifying OTP for wallet recovery' : fallback, err)
      } finally {
        if (otpOperationRef.current === otpOperation) otpOperationRef.current = null
      }
    },
    [client, creationOperationKey, isCurrentOperation, resendOperationKey, verificationOperationKey]
  )

  const submitOtp = useCallback(
    async (otp: string) => {
      if (!pageActiveRef.current || pendingOtpOperationRef.current) return
      const scope = operationScopeRef.current
      const session = captureAuthSession()
      const persistent = getOrCreatePersistentOperation({
        owner: client,
        key: verificationOperationKey,
        lane: operationLane,
        principalIsCurrent: session.isCurrent,
        start: () => scope.create({ recoveryMethod: RecoveryMethod.AUTOMATIC, otpCode: otp }),
      })
      const operation: OtpOperation = {
        kind: 'verify',
        promise: persistent.promise,
        isCurrent: persistent.isCurrent,
      }
      pendingOtpOperationRef.current = operation
      await observeOtpOperation(operation)
    },
    [captureAuthSession, client, observeOtpOperation, operationLane, verificationOperationKey]
  )

  useEffect(() => {
    if (pageActive && !pendingOtpOperationRef.current) {
      if (hasPersistentOperation(client, verificationOperationKey)) {
        const persistent = getPersistentOperation<{ error?: unknown }>(client, verificationOperationKey)
        if (!persistent) return
        pendingOtpOperationRef.current = {
          kind: 'verify',
          promise: persistent.promise,
          isCurrent: persistent.isCurrent,
        }
      } else if (hasPersistentOperation(client, resendOperationKey)) {
        const persistent = getPersistentOperation<OTPResponse>(client, resendOperationKey)
        if (!persistent) return
        pendingOtpOperationRef.current = {
          kind: 'resend',
          promise: persistent.promise,
          isCurrent: persistent.isCurrent,
        }
      }
    }
    if (!pageActive || !pendingOtpOperationRef.current || otpOperationRef.current !== null) return
    void observeOtpOperation(pendingOtpOperationRef.current)
  }, [pageActive, client, observeOtpOperation, resendOperationKey, verificationOperationKey])

  useEffect(() => {
    if (!pageActive || !shouldCreate) return
    // Wait for the state machine's account fetch to finish before calling
    // create() — concurrent SDK operations corrupt shared state.
    if (!canCreate) return
    const operationVersion = ++operationVersionRef.current
    const scope = operationScopeRef.current
    const session = captureAuthSession()
    const operation = getOrCreatePersistentOperation({
      owner: client,
      key: creationOperationKey,
      lane: operationLane,
      principalIsCurrent: session.isCurrent,
      start: async ({ isCurrent }): Promise<CreationOutcome> => {
        try {
          const result = await scope.create({ recoveryMethod: RecoveryMethod.AUTOMATIC })
          if (result.error) throw result.error
          return { status: 'success' }
        } catch (err) {
          const { error, isOTPRequired } = handleOtpRecoveryError(err, scope.isWalletRecoveryOTPEnabled)
          if (!isOTPRequired || !scope.isWalletRecoveryOTPEnabled) return { status: 'error', error }
          try {
            if (!isCurrent()) throw new AuthenticationError('Wallet creation no longer belongs to this session.')
            const response = await scope.requestOTP()
            if (!isCurrent()) throw new AuthenticationError('Wallet creation no longer belongs to this session.')
            return { status: 'otp-required', response }
          } catch (otpError) {
            logger.log('Error requesting OTP for wallet recovery', otpError)
            return { status: 'error', error: new Error('Failed to send recovery code') }
          }
        }
      },
    })
    let observing = true
    const isCurrent = () => observing && isCurrentOperation(operationVersion)
    ;(async () => {
      logger.log('Creating wallet with automatic recovery', { chain: scope.chain })
      try {
        const outcome = await operation.promise
        if (!session.isCurrent() || !operation.isCurrent() || !isCurrent()) return
        if (outcome.status === 'success') {
          clearPersistentOperation(client, creationOperationKey)
          setShouldCreate(false)
          scope.setRoute(scope.successRoute)
        } else if (outcome.status === 'otp-required') {
          setCanSendOtp(false)
          setOtpResponse(outcome.response)
          setShouldCreate(false)
        } else {
          clearPersistentOperation(client, creationOperationKey)
          logger.log('Error creating wallet', outcome.error)
          setRecoveryError(outcome.error)
          setShouldCreate(false)
        }
      } catch (err) {
        if (
          !session.isCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrent()
        )
          return
        clearPersistentOperation(client, creationOperationKey)
        logger.log('Error creating wallet', err)
        setRecoveryError(err instanceof Error ? err : new Error('Failed to create wallet'))
        setShouldCreate(false)
      }
      if (isCurrent()) scope.triggerResize()
    })()
    return () => {
      observing = false
      if (isCurrentOperation(operationVersion)) operationVersionRef.current += 1
    }
  }, [
    pageActive,
    shouldCreate,
    canCreate,
    isCurrentOperation,
    captureAuthSession,
    client,
    creationOperationKey,
    operationLane,
  ])

  // A failure message stays up long enough to be read, then the input reopens.
  useEffect(() => {
    if (otp.status !== 'error') return
    const timerId = setTimeout(() => setOtp({ status: 'idle', error: false }), OTP_ERROR_DISPLAY_MS)
    return () => clearTimeout(timerId)
  }, [otp.status])

  // Requesting a code locks the resend button until the cooldown elapses.
  useEffect(() => {
    if (canSendOtp) return
    const timerId = setTimeout(() => setCanSendOtp(true), OTP_RESEND_COOLDOWN_MS)
    return () => clearTimeout(timerId)
  }, [canSendOtp])

  const startCreation = useCallback(() => {
    setRecoveryError(null)
    setShouldCreate(true)
  }, [])

  const onResendClick = useCallback(async () => {
    if (!pageActiveRef.current || pendingOtpOperationRef.current || !canSendOtp) return
    const scope = operationScopeRef.current
    setCanSendOtp(false)
    const session = captureAuthSession()
    const persistent = getOrCreatePersistentOperation({
      owner: client,
      key: resendOperationKey,
      principalIsCurrent: session.isCurrent,
      start: () => scope.requestOTP(),
    })
    const operation: OtpOperation = {
      kind: 'resend',
      promise: persistent.promise,
      isCurrent: persistent.isCurrent,
    }
    pendingOtpOperationRef.current = operation
    await observeOtpOperation(operation)
  }, [canSendOtp, captureAuthSession, client, observeOtpOperation, resendOperationKey])

  return {
    recoveryError,
    shouldCreate,
    needsOTP: otpResponse !== null && isWalletRecoveryOTPEnabled,
    otpResponse,
    otpStatus: otp.status,
    otpError: otp.error,
    submitOtp,
    resend: {
      onClick: onResendClick,
      disabled: !canSendOtp || otp.status !== 'idle',
      label: canSendOtp ? 'Resend Code' : 'Code Sent!',
    },
    startCreation,
  }
}
