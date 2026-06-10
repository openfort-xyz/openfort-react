'use client'

import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { EmailIcon, FingerPrintIcon, KeyIcon, LockIcon, PhoneIcon, PlusIcon, ShieldIcon } from '../../../assets/icons'
import Logos from '../../../assets/logos'
import { OpenfortError } from '../../../core/errors'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
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
import { FloatingGraphic } from '../../FloatingGraphic'
import { LinkWalletOnSignUpOption, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent, type SetOnBackFunction } from '../../PageContent'
import { PasswordStrengthIndicator } from '../../PasswordStrength/PasswordStrengthIndicator'
import { getPasswordStrength, MEDIUM_SCORE_THRESHOLD } from '../../PasswordStrength/password-utility'
import Connectors from '../Connectors'
import { Body, FooterButtonText, FooterTextButton, ResultContainer } from '../EmailOTP/styles'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles'
import SolanaCreateWallet from './SolanaCreateWallet'
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
    const allowedMethods = uiConfig.walletRecovery.allowedMethods
    const otherMethods = allowedMethods.filter((method) => method !== currentMethod)
    return otherMethods
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
    return (
      <OtherMethodButton
        onClick={() => {
          onChangeMethod(method)
        }}
      >
        {text}
      </OtherMethodButton>
    )
  }

  return <OtherMethodButton onClick={() => onChangeMethod('other')}>Choose another recovery method</OtherMethodButton>
}

const CreateWalletAutomaticRecovery = ({
  onBack,
  logoutOnBack,
}: {
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  const { embeddedState, isLoadingAccounts } = useOpenfortCore()
  const { setRoute, triggerResize, walletConfig } = useOpenfort()
  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const { create } = useEthereumEmbeddedWallet()
  const { isEnabled: isWalletRecoveryOTPEnabled, requestOTP } = useRecoveryOTP()
  const [shouldCreateWallet, setShouldCreateWallet] = useState(false)
  const isCreatingRef = useRef(false)
  const hasAttemptedCreationRef = useRef(false)
  const [needsOTP, setNeedsOTP] = useState(false)
  const [otpResponse, setOtpResponse] = useState<OTPResponse | null>(null)
  const [otpStatus, setOtpStatus] = useState<'idle' | 'loading' | 'error' | 'success' | 'sending-otp' | 'send-otp'>(
    'idle'
  )
  const [error, setError] = useState<false | string>(false)
  const [canSendOtp, setCanSendOtp] = useState(true)

  const handleCompleteOtp = async (otp: string) => {
    setOtpStatus('loading')
    try {
      await create({
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        otpCode: otp,
      })
      setOtpStatus('success')
      setRoute(routes.CONNECTED_SUCCESS)
    } catch (err) {
      setOtpStatus('error')
      setError(err instanceof OpenfortError ? err.message : 'There was an error verifying the OTP')
      logger.log('Error verifying OTP for wallet recovery', err)
      setTimeout(() => {
        setOtpStatus('idle')
        setError(false)
      }, 1000)
    }
  }

  useEffect(() => {
    if (!shouldCreateWallet) return
    if (isCreatingRef.current) return
    // Wait for the state machine's fetchEmbeddedAccounts to finish before
    // calling create() — concurrent SDK operations corrupt shared state.
    if (isLoadingAccounts) return
    isCreatingRef.current = true
    ;(async () => {
      logger.log('Creating wallet Automatic recover')
      try {
        await create({ recoveryMethod: RecoveryMethod.AUTOMATIC })
        setShouldCreateWallet(false)
        setRoute(routes.CONNECTED_SUCCESS)
      } catch (err) {
        setShouldCreateWallet(false)
        const { error, isOTPRequired } = handleOtpRecoveryError(err, isWalletRecoveryOTPEnabled)
        if (isOTPRequired && isWalletRecoveryOTPEnabled) {
          try {
            const res = await requestOTP()
            setNeedsOTP(true)
            setOtpResponse(res)
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
  }, [shouldCreateWallet, create, isWalletRecoveryOTPEnabled, requestOTP, triggerResize, isLoadingAccounts])

  useEffect(() => {
    if (embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (walletConfig?.connectOnLogin === false) return
    // Guard against retry loop: when create() fails the SDK cycles the
    // embeddedState back to EMBEDDED_SIGNER_NOT_CONFIGURED which re-triggers
    // this effect.  Only attempt creation once — the user can retry manually.
    if (hasAttemptedCreationRef.current) return
    hasAttemptedCreationRef.current = true
    setShouldCreateWallet(true)
  }, [embeddedState, walletConfig?.connectOnLogin])
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

  // When connectOnLogin is false, auto-creation is skipped — show a manual
  // trigger instead of an infinite spinner.
  if (!shouldCreateWallet && !isCreatingRef.current && !recoveryError) {
    return (
      <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
        <ModalHeading>Create wallet</ModalHeading>
        <ModalBody style={{ textAlign: 'center' }}>Create an embedded wallet to get started.</ModalBody>
        <Button
          onClick={() => {
            hasAttemptedCreationRef.current = false
            setShouldCreateWallet(true)
          }}
        >
          Create wallet
        </Button>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        isError={!!recoveryError}
        header={recoveryError ? 'Error creating wallet.' : `Creating wallet...`}
        description={recoveryError ? recoveryError.message : undefined}
        onRetry={
          recoveryError
            ? () => {
                hasAttemptedCreationRef.current = false
                setRecoveryError(null)
                setShouldCreateWallet(true)
              }
            : undefined
        }
      />
    </PageContent>
  )
}

const CreateWalletPasskeyRecovery = ({
  onChangeMethod,
  onBack,
  logoutOnBack,
}: {
  onChangeMethod: (method: RecoveryMethod | 'other') => void
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  const { triggerResize, setRoute, walletConfig } = useOpenfort()
  const { create } = useEthereumEmbeddedWallet()
  const [shouldCreateWallet, setShouldCreateWallet] = useState(false)
  const isCreatingRef = useRef(false)
  const hasAttemptedCreationRef = useRef(false)
  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const { embeddedState } = useOpenfortCore()

  useEffect(() => {
    if (!shouldCreateWallet) return
    if (isCreatingRef.current) return
    isCreatingRef.current = true
    ;(async () => {
      logger.log('Creating wallet passkey recovery')
      try {
        await create({ recoveryMethod: RecoveryMethod.PASSKEY })
        setShouldCreateWallet(false)
        setRoute(routes.CONNECTED_SUCCESS)
      } catch (err) {
        logger.log('Error creating wallet', err)
        setRecoveryError(new Error('Failed to create wallet'))
        setShouldCreateWallet(false)
      } finally {
        isCreatingRef.current = false
      }
    })()
  }, [shouldCreateWallet, create])

  useEffect(() => {
    if (embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (walletConfig?.connectOnLogin === false) return
    if (hasAttemptedCreationRef.current) return
    hasAttemptedCreationRef.current = true
    setShouldCreateWallet(true)
  }, [embeddedState, walletConfig?.connectOnLogin])

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
        onRetry={() => setShouldCreateWallet(true)}
      />
      <OtherMethod currentMethod={RecoveryMethod.PASSKEY} onChangeMethod={onChangeMethod} />
    </PageContent>
  )
}

const CreateWalletPasswordRecovery = ({
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
  const { create } = useEthereumEmbeddedWallet()

  const handleSubmit = async () => {
    if (getPasswordStrength(recoveryPhrase) < MEDIUM_SCORE_THRESHOLD) {
      setShowPasswordIsTooWeakError(true)
      return
    }

    setLoading(true)
    try {
      await create({
        recoveryMethod: RecoveryMethod.PASSWORD,
        password: recoveryPhrase,
      })
      logger.log('Recovery success')
      setRoute(routes.CONNECTED_SUCCESS)
    } catch (err) {
      setRecoveryError(err instanceof OpenfortError ? err.message : 'There was an error recovering your account')
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
      <ModalHeading>Secure your wallet</ModalHeading>
      <ModalBody style={{ textAlign: 'center' }}>
        <span style={{ display: 'block', marginBottom: 16 }}>
          You will use this password to access your wallet, so keep it safe.
        </span>

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

const CreateEmbeddedWallet = ({ onBack, logoutOnBack }: { onBack: SetOnBackFunction; logoutOnBack: boolean }) => {
  const { uiConfig, triggerResize } = useOpenfort()
  const [userSelectedMethod, setUserSelectedMethod] = useState<RecoveryMethod | 'other' | null>(null)

  useEffect(() => {
    triggerResize()
  }, [userSelectedMethod])

  const method = userSelectedMethod ?? uiConfig.walletRecovery.defaultMethod
  switch (method) {
    case RecoveryMethod.PASSWORD:
      return (
        <CreateWalletPasswordRecovery
          onChangeMethod={setUserSelectedMethod}
          onBack={onBack}
          logoutOnBack={logoutOnBack}
        />
      )
    case RecoveryMethod.AUTOMATIC:
      return <CreateWalletAutomaticRecovery onBack={onBack} logoutOnBack={logoutOnBack} />
    case RecoveryMethod.PASSKEY:
      return (
        <CreateWalletPasskeyRecovery
          onChangeMethod={setUserSelectedMethod}
          onBack={onBack}
          logoutOnBack={logoutOnBack}
        />
      )
    case 'other':
      return (
        <ChooseRecoveryMethod
          onChangeMethod={setUserSelectedMethod}
          onBack={() => {
            setUserSelectedMethod(null)
          }}
          logoutOnBack={logoutOnBack}
        />
      )
    default:
      logger.error(`Unsupported recovery method: ${userSelectedMethod}${uiConfig.walletRecovery.defaultMethod}`)
      return null
  }
}

const CreateOrConnectWallet = () => {
  const [showCreateEmbeddedWallet, setShowCreateEmbeddedWallet] = useState(false)
  const { setRoute } = useOpenfort()

  if (showCreateEmbeddedWallet)
    return <CreateEmbeddedWallet onBack={() => setShowCreateEmbeddedWallet(false)} logoutOnBack={false} />
  return (
    <PageContent onBack={routes.PROVIDERS} logoutOnBack>
      <ModalHeading>Choose an option</ModalHeading>
      <ProvidersButton>
        <Button onClick={() => setShowCreateEmbeddedWallet(true)}>
          <ProviderLabel>Create Wallet</ProviderLabel>
          <ProviderIcon>
            <PlusIcon />
          </ProviderIcon>
        </Button>
      </ProvidersButton>
      <ProvidersButton>
        <Button
          onClick={() => {
            setRoute({ route: routes.CONNECTORS, connectType: 'link' })
          }}
        >
          <ProviderLabel>Connect Wallet</ProviderLabel>
          <ProviderIcon>
            <Logos.OtherWallets />
          </ProviderIcon>
        </Button>
      </ProvidersButton>
    </PageContent>
  )
}

const EthereumCreateWallet: React.FC = () => {
  const { uiConfig, walletConfig, setRoute } = useOpenfort()
  const { user, chainType } = useOpenfortCore()

  // Use chain-specific hooks
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const isConnected = wallet.status === 'connected'

  useEffect(() => {
    if (isConnected && user) setRoute(routes.CONNECTED_SUCCESS)
  }, [isConnected, user, setRoute])

  if (uiConfig.linkWalletOnSignUp === LinkWalletOnSignUpOption.OPTIONAL) {
    return <CreateOrConnectWallet />
  }

  if (
    uiConfig.linkWalletOnSignUp === LinkWalletOnSignUpOption.REQUIRED ||
    (!walletConfig && uiConfig.linkWalletOnSignUp !== LinkWalletOnSignUpOption.DISABLED)
  ) {
    return <Connectors logoutOnBack={true} />
  }

  return <CreateEmbeddedWallet onBack={routes.PROVIDERS} logoutOnBack />
}

const createWalletByChain: Record<ChainTypeEnum.EVM | ChainTypeEnum.SVM, React.ReactElement> = {
  [ChainTypeEnum.EVM]: <EthereumCreateWallet />,
  [ChainTypeEnum.SVM]: <SolanaCreateWallet onBack={routes.PROVIDERS} logoutOnBack />,
}

const CreateWallet: React.FC = () => {
  const { chainType } = useOpenfortCore()
  return createWalletByChain[chainType] ?? createWalletByChain[ChainTypeEnum.EVM]
}

export default CreateWallet
