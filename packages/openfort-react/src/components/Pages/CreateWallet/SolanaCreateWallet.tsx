'use client'

import { RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmailIcon, FingerPrintIcon, KeyIcon, LockIcon, PhoneIcon } from '../../../assets/icons'
import { OpenfortError } from '../../../core/errors'
import type { OTPResponse } from '../../../shared/hooks/useRecoveryOTP'
import { useRecoveryOTP } from '../../../shared/hooks/useRecoveryOTP'
import { handleOtpRecoveryError } from '../../../shared/utils/otpError'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import { logger } from '../../../utils/logger'
import Button from '../../Common/Button'
import FitText from '../../Common/FitText'
import Input from '../../Common/Input'
import Loader from '../../Common/Loading'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { OtpInputStandalone } from '../../Common/OTPInput'
import TickList from '../../Common/TickList'
import { FloatingGraphic } from '../../FloatingGraphic'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent, type SetOnBackFunction } from '../../PageContent'
import { PasswordStrengthIndicator } from '../../PasswordStrength/PasswordStrengthIndicator'
import { getPasswordStrength, MEDIUM_SCORE_THRESHOLD } from '../../PasswordStrength/password-utility'
import { Body, FooterButtonText, FooterTextButton, ResultContainer } from '../EmailOTP/styles'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles'
import { OtherMethodButton } from './styles'

const OtherMethod = ({
  currentMethod,
  onChangeMethod,
}: {
  currentMethod: RecoveryMethod
  onChangeMethod: (method: RecoveryMethod | 'other') => void
}) => {
  const { uiConfig } = useOpenfort()
  const otherMethods = useMemo(() => {
    return uiConfig.walletRecovery.allowedMethods.filter((method) => method !== currentMethod)
  }, [uiConfig, currentMethod])

  if (otherMethods.length === 0) return null

  if (otherMethods.length === 1) {
    const method = otherMethods[0]
    let text: string
    switch (method) {
      case RecoveryMethod.PASSWORD:
        text = 'Use password recovery instead'
        break
      case RecoveryMethod.AUTOMATIC:
        text = 'Skip for now'
        break
      case RecoveryMethod.PASSKEY:
        text = 'Use passkey recovery instead'
        break
      default:
        text = method
    }
    return <OtherMethodButton onClick={() => onChangeMethod(method)}>{text}</OtherMethodButton>
  }

  return <OtherMethodButton onClick={() => onChangeMethod('other')}>Choose another recovery method</OtherMethodButton>
}

const SolanaCreateAutomatic = ({ onBack, logoutOnBack }: { onBack: SetOnBackFunction; logoutOnBack: boolean }) => {
  const { setRoute, triggerResize } = useOpenfort()
  const embeddedWallet = useSolanaEmbeddedWallet()
  const { isEnabled: isWalletRecoveryOTPEnabled, requestOTP } = useRecoveryOTP()

  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const [shouldCreate, setShouldCreate] = useState(false)
  const [needsOTP, setNeedsOTP] = useState(false)
  const [otpResponse, setOtpResponse] = useState<OTPResponse | null>(null)
  const [otpStatus, setOtpStatus] = useState<'idle' | 'loading' | 'error' | 'success' | 'sending-otp' | 'send-otp'>(
    'idle'
  )
  const [error, setError] = useState<false | string>(false)

  const handleCompleteOtp = async (otp: string) => {
    setOtpStatus('loading')
    try {
      await embeddedWallet.create({
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        otpCode: otp,
      })
      setOtpStatus('success')
      setRoute(routes.SOL_CONNECTED)
    } catch (err) {
      setOtpStatus('error')
      setError(err instanceof OpenfortError ? err.message : 'There was an error verifying the OTP. Please try again.')
      setTimeout(() => {
        setOtpStatus('idle')
        setError(false)
      }, 1000)
    }
  }

  useEffect(() => {
    if (!shouldCreate) return
    ;(async () => {
      logger.log('Creating Solana wallet with automatic recovery')
      try {
        await embeddedWallet.create({ recoveryMethod: RecoveryMethod.AUTOMATIC })
        setRoute(routes.SOL_CONNECTED)
      } catch (err) {
        const { error, isOTPRequired } = handleOtpRecoveryError(err, isWalletRecoveryOTPEnabled)
        if (isOTPRequired && isWalletRecoveryOTPEnabled) {
          try {
            const response = await requestOTP()
            setNeedsOTP(true)
            setOtpResponse(response)
          } catch (otpErr) {
            logger.log('Error requesting OTP for wallet creation', otpErr)
            setRecoveryError(new Error('Failed to send recovery code'))
          }
        } else {
          logger.log('Error creating Solana wallet', err)
          setRecoveryError(error)
        }
      }
      triggerResize()
    })()
  }, [shouldCreate])

  const [canSendOtp, setCanSendOtp] = useState(true)

  // Trigger creation on mount. We only land here when no Solana wallet exists.
  // Don't gate on embeddedState — the user may have an EVM wallet (embeddedState=READY)
  // but still need a Solana wallet.
  useEffect(() => {
    setShouldCreate(true)
  }, [])

  const handleResendClick = useCallback(() => {
    setOtpStatus('send-otp')
    setCanSendOtp(false)
  }, [])

  const isResendDisabled = !canSendOtp || otpStatus === 'sending-otp' || otpStatus === 'send-otp'
  const sendButtonText = useMemo(() => {
    if (!canSendOtp) return 'Code Sent!'
    if (otpStatus === 'sending-otp') return 'Sending...'
    return 'Resend Code'
  }, [canSendOtp, otpStatus])

  if (needsOTP && isWalletRecoveryOTPEnabled) {
    if ((!otpResponse?.email && !otpResponse?.phone) || otpResponse.email?.includes('@openfort.anonymous')) {
      return (
        <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
          <Loader
            isError={true}
            description={'You cannot create a wallet without authentication, please link email or phone to continue.'}
            header={'Cannot create wallet.'}
          />
          <Button onClick={() => setRoute(routes.PROVIDERS)}>Add an authentication method</Button>
        </PageContent>
      )
    }
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
          <Body>
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

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        isError={!!recoveryError}
        header={recoveryError ? 'Error creating wallet.' : 'Creating wallet...'}
        description={recoveryError ? recoveryError.message : undefined}
      />
    </PageContent>
  )
}

const SolanaCreatePasskey = ({
  onChangeMethod,
  onBack,
  logoutOnBack,
}: {
  onChangeMethod: (method: RecoveryMethod | 'other') => void
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  const { triggerResize, setRoute } = useOpenfort()
  const embeddedWallet = useSolanaEmbeddedWallet()
  const [shouldCreate, setShouldCreate] = useState(false)
  const [recoveryError, setRecoveryError] = useState<Error | null>(null)

  useEffect(() => {
    if (!shouldCreate) return
    ;(async () => {
      logger.log('Creating Solana wallet with passkey recovery')
      try {
        await embeddedWallet.create({ recoveryMethod: RecoveryMethod.PASSKEY })
        setRoute(routes.SOL_CONNECTED)
      } catch (err) {
        logger.log('Error creating Solana wallet with passkey', err)
        setRecoveryError(new Error('Failed to create wallet'))
        setShouldCreate(false)
      }
    })()
  }, [shouldCreate])

  // Trigger creation on mount. We only land here when no Solana wallet exists.
  // Don't gate on embeddedState — the user may have an EVM wallet (embeddedState=READY)
  // but still need a Solana wallet.
  useEffect(() => {
    setShouldCreate(true)
  }, [])

  useEffect(() => {
    if (recoveryError) triggerResize()
  }, [recoveryError])

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        icon={<FingerPrintIcon />}
        isError={!!recoveryError}
        header={recoveryError ? 'Invalid passkey.' : 'Creating wallet with passkey...'}
        description={recoveryError ? 'There was an error creating your passkey. Please try again.' : undefined}
        onRetry={() => setShouldCreate(true)}
      />
      <OtherMethod currentMethod={RecoveryMethod.PASSKEY} onChangeMethod={onChangeMethod} />
    </PageContent>
  )
}

const SolanaCreatePassword = ({
  onChangeMethod,
  onBack,
  logoutOnBack,
}: {
  onChangeMethod: (method: RecoveryMethod | 'other') => void
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [recoveryError, setRecoveryError] = useState<false | string>(false)
  const { triggerResize, setRoute } = useOpenfort()
  const [showPasswordIsTooWeakError, setShowPasswordIsTooWeakError] = useState(false)
  const [loading, setLoading] = useState(false)
  const embeddedWallet = useSolanaEmbeddedWallet()

  const handleSubmit = async () => {
    if (getPasswordStrength(recoveryPhrase) < MEDIUM_SCORE_THRESHOLD) {
      setShowPasswordIsTooWeakError(true)
      return
    }

    setLoading(true)
    try {
      await embeddedWallet.create({
        recoveryMethod: RecoveryMethod.PASSWORD,
        password: recoveryPhrase,
      })
      setRoute(routes.SOL_CONNECTED)
    } catch (err) {
      setRecoveryError(err instanceof OpenfortError ? err.message : 'Failed to create wallet. Please try again.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (recoveryError) triggerResize()
  }, [recoveryError])

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <FloatingGraphic
        height="80px"
        logoCenter={{ logo: <KeyIcon />, size: '1.2' }}
        logoTopLeft={{ logo: <LockIcon />, size: '0.75' }}
        logoBottomRight={{ logo: <LockIcon />, size: '0.5' }}
      />
      <ModalHeading>Secure your wallet</ModalHeading>
      <ModalBody style={{ textAlign: 'center' }}>
        <FitText>Set a password for your wallet.</FitText>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <Input
            value={recoveryPhrase}
            onChange={(e) => {
              if (showPasswordIsTooWeakError) setShowPasswordIsTooWeakError(false)
              setRecoveryPhrase(e.target.value)
            }}
            type="password"
            placeholder="Enter your password"
            autoComplete="off"
          />
          <PasswordStrengthIndicator
            password={recoveryPhrase}
            showPasswordIsTooWeakError={showPasswordIsTooWeakError}
          />
          <TickList
            items={['You will use this password to access your wallet', "Make sure it's strong and memorable"]}
          />
          {recoveryError && (
            <motion.div key={recoveryError} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ModalBody style={{ height: 24, marginTop: 12 }} $error>
                <FitText>{recoveryError}</FitText>
              </ModalBody>
            </motion.div>
          )}
          <Button onClick={handleSubmit} waiting={loading} disabled={loading}>
            Create wallet
          </Button>
        </form>
        <OtherMethod currentMethod={RecoveryMethod.PASSWORD} onChangeMethod={onChangeMethod} />
      </ModalBody>
    </PageContent>
  )
}

const ChooseRecoveryMethod = ({
  onChangeMethod,
  onBack,
  logoutOnBack,
}: {
  onChangeMethod: (method: RecoveryMethod | 'other') => void
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <ModalHeading>Choose a recovery method</ModalHeading>
      <ProvidersButton>
        <Button onClick={() => onChangeMethod(RecoveryMethod.PASSKEY)}>
          <ProviderLabel>Passkey</ProviderLabel>
          <ProviderIcon>
            <FingerPrintIcon />
          </ProviderIcon>
        </Button>
      </ProvidersButton>
      <ProvidersButton>
        <Button onClick={() => onChangeMethod(RecoveryMethod.PASSWORD)}>
          <ProviderLabel>Password</ProviderLabel>
          <ProviderIcon>
            <KeyIcon />
          </ProviderIcon>
        </Button>
      </ProvidersButton>
      <ProvidersButton>
        <Button onClick={() => onChangeMethod(RecoveryMethod.AUTOMATIC)}>
          <ProviderLabel>Automatic</ProviderLabel>
          <ProviderIcon>
            <LockIcon />
          </ProviderIcon>
        </Button>
      </ProvidersButton>
    </PageContent>
  )
}

type RecoveryMethodSelection = RecoveryMethod | 'other'

const recoveryMethodComponents: Record<
  RecoveryMethod | 'other',
  React.FC<{
    onChangeMethod: (method: RecoveryMethodSelection) => void
    onBack: SetOnBackFunction
    logoutOnBack: boolean
  }>
> = {
  [RecoveryMethod.AUTOMATIC]: ({ onBack, logoutOnBack }) => (
    <SolanaCreateAutomatic onBack={onBack} logoutOnBack={logoutOnBack} />
  ),
  [RecoveryMethod.PASSKEY]: SolanaCreatePasskey,
  [RecoveryMethod.PASSWORD]: SolanaCreatePassword,
  other: ChooseRecoveryMethod,
}

const SolanaCreateWallet = ({ onBack, logoutOnBack }: { onBack: SetOnBackFunction; logoutOnBack: boolean }) => {
  const { uiConfig, triggerResize } = useOpenfort()
  const [userSelectedMethod, setUserSelectedMethod] = useState<RecoveryMethodSelection | null>(null)

  useEffect(() => {
    triggerResize()
  }, [userSelectedMethod])

  const method = userSelectedMethod ?? uiConfig.walletRecovery.defaultMethod
  const Component = recoveryMethodComponents[method]

  if (!Component) {
    logger.error(`Unsupported recovery method: ${method}`)
    return null
  }

  return <Component onChangeMethod={setUserSelectedMethod} onBack={onBack} logoutOnBack={logoutOnBack} />
}

export default SolanaCreateWallet
