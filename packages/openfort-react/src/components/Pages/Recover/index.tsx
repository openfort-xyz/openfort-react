'use client'

import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmailIcon, FingerPrintIcon, KeyIcon, LockIcon, PhoneIcon, ShieldIcon } from '../../../assets/icons.js'
import { AuthenticationError } from '../../../errors/auth.js'
import { OpenfortError } from '../../../errors/base.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import type { EthereumUserWallet, SolanaUserWallet } from '../../../hooks/openfort/walletTypes.js'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useRecoveryOTP } from '../../../shared/hooks/useRecoveryOTP.js'
import type { RecoverableWallet } from '../../../shared/types.js'
import {
  clearPersistentOperation,
  getOrCreatePersistentOperation,
  getPersistentOperation,
  hasPersistentOperation,
  type PersistentOperation,
  PersistentOperationLaneBusyError,
} from '../../../shared/utils/persistentOperationRegistry.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import { truncateEthAddress } from '../../../utils/index.js'
import { logger } from '../../../utils/logger.js'
import Button from '../../Common/Button/index.js'
import { CopyText } from '../../Common/CopyToClipboard/CopyText.js'
import FitText from '../../Common/FitText/index.js'
import Input from '../../Common/Input/index.js'
import Loader from '../../Common/Loading/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { OtpInputStandalone } from '../../Common/OTPInput/index.js'
import { FloatingGraphic } from '../../FloatingGraphic/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent, type SetOnBackFunction } from '../../PageContent/index.js'
import { Body, FooterButtonText, FooterTextButton, ResultContainer } from '../EmailOTP/styles.js'
import { useLatestAsyncAttempt } from '../useLatestAsyncAttempt.js'
import { recoveryRegistry } from './recoveryRegistry.js'

function useRecoveryOperationScope(wallet: EthereumUserWallet | SolanaUserWallet) {
  const client = useOpenfortCore((state) => state.client)
  const { captureAuthSession } = useAuthTransitions()
  return {
    client,
    captureAuthSession,
    operationPrefix: `wallet-recover:${wallet.chainType}:${wallet.address}`,
  }
}

const RecoverPasswordWallet = ({
  wallet,
  onBack,
  logoutOnBack,
}: {
  wallet: EthereumUserWallet | SolanaUserWallet
  onBack: SetOnBackFunction
  logoutOnBack?: boolean
}) => {
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [recoveryError, setRecoveryError] = useState<false | string>(false)
  const { triggerResize, setRoute } = useOpenfort()
  const [loading, setLoading] = useState(false)
  const chainType = useOpenfortCore((s) => s.chainType)
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const { active, beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
  const { client, captureAuthSession, operationPrefix } = useRecoveryOperationScope(wallet)
  const operationKey = `${operationPrefix}:password`

  const { isEnabled: otpEnabled, requestOTP } = useRecoveryOTP()

  const ctx = useMemo(
    () => ({
      setActive: (opts: {
        address: string
        password?: string
        recoveryMethod?: RecoveryMethod
        otpCode?: string
        passkeyId?: string
      }) => embeddedWallet.setActive(opts as never),
      setRoute,
      setError: setRecoveryError,
      otp: { isEnabled: otpEnabled, request: requestOTP },
      setNeedsOTP: () => {},
      setOtpResponse: () => {},
    }),
    [embeddedWallet, setRoute, otpEnabled, requestOTP]
  )

  type PasswordRecoveryResult = { route?: Parameters<typeof setRoute>[0]; error: string | false }

  const observeRecovery = useCallback(
    async (operation: PersistentOperation<PasswordRecoveryResult>, principalIsCurrent: () => boolean) => {
      setLoading(true)
      const attempt = beginAttempt()
      try {
        const result = await operation.promise
        if (!principalIsCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
        clearPersistentOperation(client, operationKey)
        setRecoveryError(result.error)
        if (result.route) setRoute(result.route)
      } catch (err) {
        if (
          !principalIsCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentAttempt(attempt)
        )
          return
        clearPersistentOperation(client, operationKey)
        setRecoveryError(err instanceof OpenfortError ? err.message : 'Recovery failed. Please try again.')
      } finally {
        if (principalIsCurrent() && isCurrentAttempt(attempt)) setLoading(false)
      }
    },
    [beginAttempt, client, isCurrentAttempt, operationKey, setRoute]
  )

  const handleSubmit = () => {
    const authSession = captureAuthSession()
    const existing = getPersistentOperation<PasswordRecoveryResult>(client, operationKey)
    const operation =
      existing ??
      getOrCreatePersistentOperation({
        owner: client,
        key: operationKey,
        lane: operationPrefix,
        principalIsCurrent: authSession.isCurrent,
        start: async () => {
          const result: PasswordRecoveryResult = { error: false }
          await recoveryRegistry[chainType].password(wallet as RecoverableWallet, {
            ...ctx,
            password: recoveryPhrase,
            setRoute: (route) => {
              result.route = route
            },
            setError: (error) => {
              result.error = error
            },
          })
          return result
        },
      })
    void observeRecovery(operation, authSession.isCurrent)
  }

  useEffect(() => {
    if (!active) return
    const existing = getPersistentOperation<PasswordRecoveryResult>(client, operationKey)
    if (!existing) return
    const authSession = captureAuthSession()
    void observeRecovery(existing, authSession.isCurrent)
  }, [active, captureAuthSession, client, observeRecovery, operationKey])

  useEffect(() => {
    if (recoveryError) triggerResize()
  }, [recoveryError, triggerResize])

  const identity = useResolvedIdentity({
    address: wallet.address,
    chainType,
    enabled: !!wallet.address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <FloatingGraphic
        height="130px"
        logoCenter={{
          logo: <KeyIcon />,
          size: '1.2',
        }}
        logoTopLeft={{
          logo: <ShieldIcon />,
          size: '0.75',
        }}
        logoBottomRight={{
          logo: <LockIcon />,
          size: '0.5',
        }}
      />
      <ModalHeading>Recover wallet</ModalHeading>
      <ModalBody style={{ textAlign: 'center' }}>
        Please enter the password to recover wallet{' '}
        <CopyText value={wallet.address}>{ensName ?? truncateEthAddress(wallet.address)}</CopyText>
      </ModalBody>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <Input
          value={recoveryPhrase}
          onChange={(e) => setRecoveryPhrase(e.target.value)}
          type="password"
          placeholder="Enter your password"
          autoComplete="off"
          disabled={loading}
        />

        {recoveryError && (
          <motion.div key={recoveryError} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalBody style={{ height: 24, marginTop: 12 }} $error>
              <FitText>{recoveryError}</FitText>
            </ModalBody>
          </motion.div>
        )}
        <Button type="submit" waiting={loading} disabled={loading}>
          Recover wallet
        </Button>
      </form>
    </PageContent>
  )
}

const RecoverPasskeyWallet = ({
  wallet,
  onBack,
  logoutOnBack,
}: {
  wallet: EthereumUserWallet | SolanaUserWallet
  onBack: SetOnBackFunction
  logoutOnBack?: boolean
}) => {
  const { triggerResize, setRoute } = useOpenfort()
  const [recoveryError, setRecoveryError] = useState<false | string>(false)
  const chainType = useOpenfortCore((s) => s.chainType)
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const { active, beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
  const { client, captureAuthSession, operationPrefix } = useRecoveryOperationScope(wallet)
  const operationKey = `${operationPrefix}:passkey`

  const { isEnabled: otpEnabled, requestOTP } = useRecoveryOTP()

  const ctx = useMemo(
    () => ({
      setActive: (opts: {
        address: string
        password?: string
        recoveryMethod?: RecoveryMethod
        otpCode?: string
        passkeyId?: string
      }) => embeddedWallet.setActive(opts as never),
      setRoute,
      setError: setRecoveryError,
      otp: { isEnabled: otpEnabled, request: requestOTP },
      setNeedsOTP: () => {},
      setOtpResponse: () => {},
    }),
    [embeddedWallet, setRoute, otpEnabled, requestOTP]
  )

  const recoverWallet = useCallback(async () => {
    const attempt = beginAttempt()
    const session = captureAuthSession()
    const operation = getOrCreatePersistentOperation({
      owner: client,
      key: operationKey,
      principalIsCurrent: session.isCurrent,
      start: async () => {
        const result: { route?: Parameters<typeof setRoute>[0]; error: string | false } = { error: false }
        await recoveryRegistry[chainType].passkey(wallet as RecoverableWallet, {
          ...ctx,
          setRoute: (route) => {
            result.route = route
          },
          setError: (error) => {
            result.error = error
          },
        })
        return result
      },
    })
    try {
      const result = await operation.promise
      if (!session.isCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
      clearPersistentOperation(client, operationKey)
      setRecoveryError(result.error)
      if (result.route) setRoute(result.route)
    } catch (err) {
      if (
        !session.isCurrent() ||
        (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
        !isCurrentAttempt(attempt)
      )
        return
      clearPersistentOperation(client, operationKey)
      setRecoveryError(err instanceof OpenfortError ? err.message : 'Invalid passkey. Please try again.')
    }
  }, [beginAttempt, captureAuthSession, chainType, client, wallet, ctx, isCurrentAttempt, operationKey, setRoute])

  const shouldRecoverWalletRef = useRef(false)
  useEffect(() => {
    if (!active) {
      shouldRecoverWalletRef.current = false
      return
    }
    if (shouldRecoverWalletRef.current) return
    shouldRecoverWalletRef.current = true
    recoverWallet()
  }, [active, recoverWallet])

  useEffect(() => {
    if (recoveryError) triggerResize()
  }, [recoveryError, triggerResize])

  const identity = useResolvedIdentity({
    address: wallet.address,
    chainType,
    enabled: !!wallet.address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined
  const walletDisplay = ensName ?? truncateEthAddress(wallet.address)

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        icon={<FingerPrintIcon />}
        isError={!!recoveryError}
        header={recoveryError ? 'Invalid passkey.' : `Recovering wallet ${walletDisplay} with passkey...`}
        description={recoveryError ? 'There was an error creating your passkey. Please try again.' : undefined}
        onRetry={() => recoverWallet()}
      />
    </PageContent>
  )
}

const RecoverAutomaticWallet = ({
  wallet,
  onBack,
  logoutOnBack,
}: {
  wallet: EthereumUserWallet | SolanaUserWallet
  onBack: SetOnBackFunction
  logoutOnBack?: boolean
}) => {
  const embeddedState = useOpenfortCore((s) => s.embeddedState)
  const { setRoute } = useOpenfort()
  const chainType = useOpenfortCore((s) => s.chainType)
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const { isEnabled: isWalletRecoveryOTPEnabled, requestOTP } = useRecoveryOTP()
  const [error, setError] = useState<false | string>(false)
  const [needsOTP, setNeedsOTP] = useState(false)
  const [otpResponse, setOtpResponse] = useState<Awaited<ReturnType<typeof requestOTP>> | null>(null)
  const [otpStatus, setOtpStatus] = useState<'idle' | 'loading' | 'error' | 'success' | 'sending-otp' | 'send-otp'>(
    'idle'
  )
  const [canSendOtp, setCanSendOtp] = useState(true)
  const { active, beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
  const otpOperationRef = useRef<number | null>(null)
  const otpOperationSequenceRef = useRef(0)
  const routeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  type AutomaticRecoverySnapshot = {
    error: string | false
    needsOTP: boolean
    otpResponse: Awaited<ReturnType<typeof requestOTP>> | null
  }
  type AutomaticRecoveryOperation = {
    promise: ReturnType<(typeof recoveryRegistry)[typeof chainType]['automatic']>
    result: AutomaticRecoverySnapshot
  }
  const automaticRecoveryRef = useRef<AutomaticRecoveryOperation | null>(null)
  const otpRecoveryRef = useRef<AutomaticRecoveryOperation | null>(null)
  const resendOperationRef = useRef<{ promise: ReturnType<typeof requestOTP> } | null>(null)
  const { client, captureAuthSession, operationPrefix } = useRecoveryOperationScope(wallet)
  const automaticOperationKey = `${operationPrefix}:automatic`
  const otpOperationKey = `${operationPrefix}:otp-verify`
  const resendOperationKey = `${operationPrefix}:otp-resend`

  const createRecoveryContext = useCallback(
    (result: AutomaticRecoverySnapshot, otpCode?: string, operationIsCurrent: () => boolean = () => true) => ({
      setActive: (opts: {
        address: string
        password?: string
        recoveryMethod?: RecoveryMethod
        otpCode?: string
        passkeyId?: string
      }) => embeddedWallet.setActive(opts as never),
      setRoute: () => {},
      setError: (error: string | false) => {
        result.error = error
      },
      otp: {
        isEnabled: isWalletRecoveryOTPEnabled,
        request: async () => {
          if (!operationIsCurrent()) throw new AuthenticationError('Wallet recovery no longer belongs to this session.')
          const response = await requestOTP()
          if (!operationIsCurrent()) throw new AuthenticationError('Wallet recovery no longer belongs to this session.')
          return response
        },
      },
      setNeedsOTP: (needsOTP: boolean) => {
        result.needsOTP = needsOTP
      },
      setOtpResponse: (response: Awaited<ReturnType<typeof requestOTP>> | null) => {
        result.otpResponse = response
      },
      otpCode,
    }),
    [embeddedWallet, isWalletRecoveryOTPEnabled, requestOTP]
  )

  const createAutomaticOperation = useCallback(
    (key: string, otpCode?: string): AutomaticRecoveryOperation => {
      const session = captureAuthSession()
      const persistent = getOrCreatePersistentOperation({
        owner: client,
        key,
        principalIsCurrent: session.isCurrent,
        start: async ({ isCurrent }) => {
          const result: AutomaticRecoverySnapshot = { error: false, needsOTP: false, otpResponse: null }
          const outcome = await recoveryRegistry[chainType].automatic(
            wallet as RecoverableWallet,
            createRecoveryContext(result, otpCode, isCurrent)
          )
          return { outcome, result }
        },
      })
      const result: AutomaticRecoverySnapshot = { error: false, needsOTP: false, otpResponse: null }
      return {
        result,
        promise: persistent.promise.then((settlement) => {
          Object.assign(result, settlement.result)
          return settlement.outcome
        }),
      }
    },
    [captureAuthSession, chainType, client, wallet, createRecoveryContext]
  )

  const recoverWallet = useCallback(async () => {
    if (chainType !== ChainTypeEnum.SVM && embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    const attempt = beginAttempt()
    logger.log('Automatically recovering wallet', wallet.address)
    const operation = automaticRecoveryRef.current ?? createAutomaticOperation(automaticOperationKey)
    automaticRecoveryRef.current = operation
    const outcome = await operation.promise
    if (!isCurrentAttempt(attempt)) return
    automaticRecoveryRef.current = null
    setError(operation.result.error)
    setNeedsOTP(operation.result.needsOTP)
    setOtpResponse(operation.result.otpResponse)
    if (outcome.status === 'otp-required') setCanSendOtp(false)
    if (outcome.status === 'success') {
      clearPersistentOperation(client, automaticOperationKey)
      setRoute(routes.CONNECTED_SUCCESS)
    } else if (outcome.status === 'error') {
      clearPersistentOperation(client, automaticOperationKey)
    }
  }, [
    wallet,
    embeddedState,
    chainType,
    beginAttempt,
    createAutomaticOperation,
    isCurrentAttempt,
    setRoute,
    automaticOperationKey,
    client,
  ])

  const shouldRecoverWalletRef = useRef(false)
  useEffect(() => {
    if (!active) {
      shouldRecoverWalletRef.current = false
      return
    }
    if (needsOTP) {
      shouldRecoverWalletRef.current = true
      return
    }
    if (shouldRecoverWalletRef.current) return
    shouldRecoverWalletRef.current = true
    recoverWallet()
  }, [active, needsOTP, recoverWallet])

  const identity = useResolvedIdentity({
    address: wallet.address,
    chainType,
    enabled: !!wallet.address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined
  const walletDisplay = ensName ?? truncateEthAddress(wallet.address)
  useEffect(
    () => () => {
      clearTimeout(routeTimeoutRef.current)
      clearTimeout(errorTimeoutRef.current)
    },
    []
  )

  useEffect(() => {
    if (active) return
    otpOperationRef.current = null
    clearTimeout(routeTimeoutRef.current)
    clearTimeout(errorTimeoutRef.current)
    setOtpStatus((status) =>
      status === 'loading' || status === 'sending-otp' || status === 'success' ? 'idle' : status
    )
  }, [active])

  useEffect(() => {
    if (!active || canSendOtp) return
    const timerId = setTimeout(() => setCanSendOtp(true), 10000)
    return () => clearTimeout(timerId)
  }, [active, canSendOtp])

  useEffect(() => {
    if (!active || otpStatus !== 'error') return
    clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => {
      setOtpStatus('idle')
      setError(false)
    }, 1000)
    return () => clearTimeout(errorTimeoutRef.current)
  }, [active, otpStatus])

  const observeOtpRecovery = useCallback(
    async (operation: AutomaticRecoveryOperation) => {
      if (!active || otpOperationRef.current !== null) return
      const otpOperation = ++otpOperationSequenceRef.current
      otpOperationRef.current = otpOperation
      const attempt = beginAttempt()
      setOtpStatus('loading')
      try {
        const outcome = await operation.promise
        if (!isCurrentAttempt(attempt)) return
        otpRecoveryRef.current = null
        setError(operation.result.error)
        setNeedsOTP(operation.result.needsOTP || needsOTP)
        setOtpResponse(operation.result.otpResponse ?? otpResponse)
        if (outcome.status !== 'success') {
          if (outcome.status === 'error') clearPersistentOperation(client, otpOperationKey)
          setOtpStatus(outcome.status === 'error' ? 'error' : 'idle')
          return
        }
        clearPersistentOperation(client, otpOperationKey)
        clearPersistentOperation(client, automaticOperationKey)
        setOtpStatus('success')
        clearTimeout(routeTimeoutRef.current)
        routeTimeoutRef.current = setTimeout(() => {
          if (isCurrentAttempt(attempt)) setRoute(routes.CONNECTED_SUCCESS)
        }, 1000)
      } catch (err) {
        if (!isCurrentAttempt(attempt)) return
        otpRecoveryRef.current = null
        setOtpStatus('error')
        setError(err instanceof OpenfortError ? err.message : 'There was an error verifying the OTP. Please try again.')
        logger.log('Error verifying OTP for wallet recovery', err)
      } finally {
        if (otpOperationRef.current === otpOperation) otpOperationRef.current = null
      }
    },
    [
      active,
      automaticOperationKey,
      beginAttempt,
      client,
      isCurrentAttempt,
      needsOTP,
      otpOperationKey,
      otpResponse,
      setRoute,
    ]
  )

  const handleCompleteOtp = useCallback(
    async (otp: string) => {
      if (!active || otpRecoveryRef.current || otpOperationRef.current !== null || otpStatus !== 'idle') return
      const operation = createAutomaticOperation(otpOperationKey, otp)
      otpRecoveryRef.current = operation
      await observeOtpRecovery(operation)
    },
    [active, otpStatus, createAutomaticOperation, observeOtpRecovery, otpOperationKey]
  )

  useEffect(() => {
    if (active && !otpRecoveryRef.current && hasPersistentOperation(client, otpOperationKey)) {
      otpRecoveryRef.current = createAutomaticOperation(otpOperationKey)
    }
    if (!active || !otpRecoveryRef.current || otpOperationRef.current !== null) return
    void observeOtpRecovery(otpRecoveryRef.current)
  }, [active, client, createAutomaticOperation, observeOtpRecovery, otpOperationKey])

  const observeResend = useCallback(
    async (operation: { promise: ReturnType<typeof requestOTP> }) => {
      if (!active || otpOperationRef.current !== null) return
      const otpOperation = ++otpOperationSequenceRef.current
      otpOperationRef.current = otpOperation
      const attempt = beginAttempt()
      setOtpStatus('sending-otp')
      try {
        const response = await operation.promise
        if (!isCurrentAttempt(attempt)) return
        resendOperationRef.current = null
        clearPersistentOperation(client, resendOperationKey)
        setOtpResponse(response)
        setOtpStatus('idle')
      } catch (err) {
        if (!isCurrentAttempt(attempt)) return
        resendOperationRef.current = null
        clearPersistentOperation(client, resendOperationKey)
        logger.log('Error requesting OTP for wallet recovery', err)
        setError(err instanceof OpenfortError ? err.message : 'Failed to send recovery code')
        setOtpStatus('error')
      } finally {
        if (otpOperationRef.current === otpOperation) otpOperationRef.current = null
      }
    },
    [active, beginAttempt, client, isCurrentAttempt, resendOperationKey]
  )

  const handleResendClick = useCallback(async () => {
    if (
      !active ||
      resendOperationRef.current ||
      otpOperationRef.current !== null ||
      !canSendOtp ||
      otpStatus !== 'idle'
    )
      return
    setCanSendOtp(false)
    const session = captureAuthSession()
    const operation = {
      promise: getOrCreatePersistentOperation({
        owner: client,
        key: resendOperationKey,
        principalIsCurrent: session.isCurrent,
        start: () => requestOTP(),
      }).promise,
    }
    resendOperationRef.current = operation
    await observeResend(operation)
  }, [active, canSendOtp, captureAuthSession, client, observeResend, otpStatus, requestOTP, resendOperationKey])

  useEffect(() => {
    if (active && !resendOperationRef.current) {
      const persistent = getPersistentOperation<Awaited<ReturnType<typeof requestOTP>>>(client, resendOperationKey)
      if (persistent) resendOperationRef.current = { promise: persistent.promise }
    }
    if (!active || !resendOperationRef.current || otpOperationRef.current !== null) return
    void observeResend(resendOperationRef.current)
  }, [active, client, observeResend, resendOperationKey])

  const isResendDisabled = !canSendOtp || otpStatus !== 'idle'
  const sendButtonText = useMemo(() => {
    if (otpStatus === 'sending-otp') return 'Sending...'
    if (!canSendOtp) return 'Code Sent!'
    return 'Resend Code'
  }, [canSendOtp, otpStatus])

  if (needsOTP && isWalletRecoveryOTPEnabled) {
    return (
      <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
        <ModalHeading>Enter your code</ModalHeading>

        <FloatingGraphic
          height="100px"
          marginTop="8px"
          marginBottom="10px"
          logoCenter={{
            logo: otpResponse?.sentTo === 'phone' ? <PhoneIcon /> : <EmailIcon />,
          }}
        />
        <ModalBody>
          <Body as="div">
            Recovering wallet <CopyText value={wallet.address}>{walletDisplay}</CopyText>
            Please check <b>{otpResponse?.sentTo === 'phone' ? otpResponse?.phone : otpResponse?.email}</b> and enter
            your code below.
          </Body>
          <OtpInputStandalone
            length={9}
            scale="80%"
            onComplete={handleCompleteOtp}
            isLoading={otpStatus === 'loading'}
            isError={otpStatus === 'error'}
            isSuccess={otpStatus === 'success'}
          />
          <ResultContainer>
            {otpStatus === 'success' && <ModalBody $valid>Code verified successfully!</ModalBody>}
            {otpStatus === 'error' && <ModalBody $error>{error || 'Invalid code. Please try again.'}</ModalBody>}
          </ResultContainer>
          <FooterTextButton>
            Didn't receive the code?{' '}
            <FooterButtonText type="button" onClick={handleResendClick} disabled={isResendDisabled}>
              {sendButtonText}
            </FooterButtonText>
          </FooterTextButton>
        </ModalBody>
      </PageContent>
    )
  }

  if (error) {
    return (
      <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
        <ModalBody style={{ textAlign: 'center' }} $error>
          <FitText>{error}</FitText>
        </ModalBody>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <Loader header={`Recovering wallet...`} />
    </PageContent>
  )
}

type RecoverWalletProps = {
  wallet: EthereumUserWallet | SolanaUserWallet
  onBack: SetOnBackFunction
  logoutOnBack?: boolean
}

const RECOVER_WALLET_REGISTRY: Partial<Record<RecoveryMethod, React.FC<RecoverWalletProps>>> = {
  [RecoveryMethod.PASSWORD]: RecoverPasswordWallet,
  [RecoveryMethod.AUTOMATIC]: RecoverAutomaticWallet,
  [RecoveryMethod.PASSKEY]: RecoverPasskeyWallet,
}

const RecoverWallet = ({ wallet, onBack, logoutOnBack }: RecoverWalletProps) => {
  const Component = RECOVER_WALLET_REGISTRY[wallet.recoveryMethod ?? RecoveryMethod.AUTOMATIC]
  if (!Component) {
    logger.error(`Unsupported recovery method: ${wallet.recoveryMethod}, defaulting to automatic.`)
    return <RecoverAutomaticWallet wallet={wallet} onBack={onBack} logoutOnBack={logoutOnBack} />
  }
  return <Component wallet={wallet} onBack={onBack} logoutOnBack={logoutOnBack} />
}

const RecoverPage: React.FC = () => {
  const { previousRoute, route } = useOpenfort()
  const wallet =
    route.route === routes.SOL_RECOVER_WALLET
      ? (route as { route: typeof routes.SOL_RECOVER_WALLET; wallet: SolanaUserWallet }).wallet
      : route.route === routes.RECOVER_WALLET
        ? (route as { route: typeof routes.RECOVER_WALLET; wallet: EthereumUserWallet }).wallet
        : undefined

  const { onBack, logoutOnBack } = useMemo<{
    onBack: SetOnBackFunction
    logoutOnBack?: boolean
  }>(() => {
    if (previousRoute?.route === routes.SELECT_WALLET_TO_RECOVER) {
      return {
        onBack: 'back',
        logoutOnBack: false,
      }
    }

    return { onBack: routes.PROVIDERS, logoutOnBack: true }
  }, [previousRoute])

  if (!wallet) return null
  return <RecoverWallet wallet={wallet} onBack={onBack} logoutOnBack={logoutOnBack} />
}

export default RecoverPage
