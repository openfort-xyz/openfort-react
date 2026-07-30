'use client'

import { RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { FingerPrintIcon, KeyIcon, LockIcon } from '../../../assets/icons.js'
import { OpenfortError } from '../../../errors/base.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import { logger } from '../../../utils/logger.js'
import Button from '../../Common/Button/index.js'
import FitText from '../../Common/FitText/index.js'
import Input from '../../Common/Input/index.js'
import Loader from '../../Common/Loading/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import TickList from '../../Common/TickList/index.js'
import { FloatingGraphic } from '../../FloatingGraphic/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent, type SetOnBackFunction } from '../../PageContent/index.js'
import { PasswordStrengthIndicator } from '../../PasswordStrength/PasswordStrengthIndicator.js'
import { getPasswordStrength, MEDIUM_SCORE_THRESHOLD } from '../../PasswordStrength/password-utility.js'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles.js'
import AutomaticRecoveryOtpPage from './AutomaticRecoveryOtpPage.js'
import { OtherMethodButton } from './styles.js'
import { useAutomaticRecovery } from './useAutomaticRecovery.js'

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

  const [method] = otherMethods
  if (otherMethods.length === 1 && method) {
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
  const { create } = useSolanaEmbeddedWallet()

  const recovery = useAutomaticRecovery({
    chain: 'Solana',
    create,
    successRoute: routes.SOL_CONNECTED,
    otpVerificationError: 'There was an error verifying the OTP. Please try again.',
    canCreate: true,
  })
  const { startCreation } = recovery

  // Trigger creation on mount. We only land here when no Solana wallet exists.
  // Don't gate on embeddedState — the user may have an EVM wallet (embeddedState=READY)
  // but still need a Solana wallet.
  useEffect(() => {
    startCreation()
  }, [startCreation])

  if (recovery.needsOTP) {
    return <AutomaticRecoveryOtpPage recovery={recovery} onBack={onBack} logoutOnBack={logoutOnBack} />
  }

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        isError={!!recovery.recoveryError}
        header={recovery.recoveryError ? 'Error creating wallet.' : 'Creating wallet...'}
        description={recovery.recoveryError ? recovery.recoveryError.message : undefined}
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

  // Wallet creation is not idempotent, so this runs on the `shouldCreate` edge alone: re-running it
  // for a new `embeddedWallet.create` identity would prompt the user for a second passkey.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one create call per `shouldCreate` edge, see above
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
  }, [recoveryError, triggerResize])

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
  }, [recoveryError, triggerResize])

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
          {recoveryPhrase && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TickList
                items={["Make sure it's strong and memorable", 'If you lose it, no one can recover it for you']}
              />
            </motion.div>
          )}
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `userSelectedMethod` is the trigger — each recovery method renders a differently sized page
  useEffect(() => {
    triggerResize()
  }, [userSelectedMethod, triggerResize])

  const method = userSelectedMethod ?? uiConfig.walletRecovery.defaultMethod
  const Component = recoveryMethodComponents[method]

  if (!Component) {
    logger.error(`Unsupported recovery method: ${method}`)
    return null
  }

  return <Component onChangeMethod={setUserSelectedMethod} onBack={onBack} logoutOnBack={logoutOnBack} />
}

export default SolanaCreateWallet
