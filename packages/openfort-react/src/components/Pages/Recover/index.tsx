'use client'

import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmailIcon, FingerPrintIcon, KeyIcon, LockIcon, PhoneIcon, ShieldIcon } from '../../../assets/icons'
import { OpenfortError } from '../../../core/errors'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import type { EthereumUserWallet, SolanaUserWallet } from '../../../hooks/openfort/walletTypes'
import { useResolvedIdentity } from '../../../hooks/useResolvedIdentity'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useRecoveryOTP } from '../../../shared/hooks/useRecoveryOTP'
import type { RecoverableWallet } from '../../../shared/types'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import { truncateEthAddress } from '../../../utils'
import { logger } from '../../../utils/logger'
import Button from '../../Common/Button'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import FitText from '../../Common/FitText'
import Input from '../../Common/Input'
import Loader from '../../Common/Loading'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { OtpInputStandalone } from '../../Common/OTPInput'
import { FloatingGraphic } from '../../FloatingGraphic'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent, type SetOnBackFunction } from '../../PageContent'
import { Body, FooterButtonText, FooterTextButton, ResultContainer } from '../EmailOTP/styles'
import { recoveryRegistry } from './recoveryRegistry'

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
  const { chainType } = useOpenfortCore()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

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

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await recoveryRegistry[chainType].password(wallet as RecoverableWallet, {
        ...ctx,
        password: recoveryPhrase,
      })
    } catch (err) {
      setRecoveryError(err instanceof OpenfortError ? err.message : 'Recovery failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
        />

        {recoveryError && (
          <motion.div key={recoveryError} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalBody style={{ height: 24, marginTop: 12 }} $error>
              <FitText>{recoveryError}</FitText>
            </ModalBody>
          </motion.div>
        )}
        <Button onClick={handleSubmit} waiting={loading} disabled={loading}>
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
  const { chainType } = useOpenfortCore()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const embeddedWallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

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
    try {
      await recoveryRegistry[chainType].passkey(wallet as RecoverableWallet, ctx)
    } catch (err) {
      setRecoveryError(err instanceof OpenfortError ? err.message : 'Invalid passkey. Please try again.')
    }
  }, [chainType, wallet, ctx])

  const shouldRecoverWalletRef = useRef(false)
  useEffect(() => {
    if (shouldRecoverWalletRef.current) return
    shouldRecoverWalletRef.current = true
    recoverWallet()
  }, [recoverWallet])

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
  const { embeddedState } = useOpenfortCore()
  const { setRoute } = useOpenfort()
  const { chainType } = useOpenfortCore()
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

  const baseCtx = useMemo(
    () => ({
      setActive: (opts: {
        address: string
        password?: string
        recoveryMethod?: RecoveryMethod
        otpCode?: string
        passkeyId?: string
      }) => embeddedWallet.setActive(opts as never),
      setRoute,
      setError,
      otp: { isEnabled: isWalletRecoveryOTPEnabled, request: requestOTP },
      setNeedsOTP,
      setOtpResponse,
    }),
    [embeddedWallet, setRoute, isWalletRecoveryOTPEnabled, requestOTP]
  )

  const recoverWallet = useCallback(async () => {
    if (chainType !== ChainTypeEnum.SVM && embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    logger.log('Automatically recovering wallet', wallet.address)
    await recoveryRegistry[chainType].automatic(wallet as RecoverableWallet, baseCtx)
  }, [wallet, embeddedState, chainType, baseCtx])

  const shouldRecoverWalletRef = useRef(false)
  useEffect(() => {
    if (shouldRecoverWalletRef.current) return
    shouldRecoverWalletRef.current = true
    recoverWallet()
  }, [recoverWallet])

  const identity = useResolvedIdentity({
    address: wallet.address,
    chainType,
    enabled: !!wallet.address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined
  const walletDisplay = ensName ?? truncateEthAddress(wallet.address)
  const [canSendOtp, setCanSendOtp] = useState(true)

  useEffect(() => {
    if (canSendOtp) return
    const timerId = setTimeout(() => setCanSendOtp(true), 10000)
    return () => clearTimeout(timerId)
  }, [canSendOtp])

  const handleCompleteOtp = useCallback(
    async (otp: string) => {
      setOtpStatus('loading')
      try {
        await recoveryRegistry[chainType].automatic(wallet as RecoverableWallet, { ...baseCtx, otpCode: otp })
        setOtpStatus('success')
        setTimeout(() => setRoute(routes.CONNECTED_SUCCESS), 1000)
      } catch (err) {
        setOtpStatus('error')
        setError(err instanceof OpenfortError ? err.message : 'There was an error verifying the OTP. Please try again.')
        logger.log('Error verifying OTP for wallet recovery', err)
        setTimeout(() => {
          setOtpStatus('idle')
          setError(false)
        }, 1000)
      }
    },
    [chainType, wallet, baseCtx, setRoute]
  )

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
