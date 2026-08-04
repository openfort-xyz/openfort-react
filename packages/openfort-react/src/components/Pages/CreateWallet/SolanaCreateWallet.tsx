'use client'

import { RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FingerPrintIcon, KeyIcon, LockIcon } from '../../../assets/icons.js'
import { OpenfortError } from '../../../errors/base.js'
import { useAuthTransitions } from '../../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import {
  clearPersistentOperation,
  getOrCreatePersistentOperation,
  getPersistentOperation,
  type PersistentOperation,
  PersistentOperationLaneBusyError,
} from '../../../shared/utils/persistentOperationRegistry.js'
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
import { useLatestAsyncAttempt } from '../useLatestAsyncAttempt.js'
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
        onRetry={recovery.recoveryError ? startCreation : undefined}
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
  const create = embeddedWallet.create
  const [shouldCreate, setShouldCreate] = useState(false)
  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const client = useOpenfortCore((state) => state.client)
  const { captureAuthSession } = useAuthTransitions()
  const operationLane = 'wallet-create:Solana'
  const operationKey = `${operationLane}:passkey`
  const { active, beginAttempt, isCurrentAttempt, cancelAttempt } = useLatestAsyncAttempt()

  useEffect(() => {
    if (!active || !shouldCreate) return
    const attempt = beginAttempt()
    const session = captureAuthSession()
    const operation = getOrCreatePersistentOperation({
      owner: client,
      key: operationKey,
      lane: operationLane,
      principalIsCurrent: session.isCurrent,
      start: () => create({ recoveryMethod: RecoveryMethod.PASSKEY }),
    })
    let observing = true
    ;(async () => {
      logger.log('Creating Solana wallet with passkey recovery')
      try {
        const result = await operation.promise
        if (!observing || !session.isCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
        if (result.error) {
          clearPersistentOperation(client, operationKey)
          logger.log('Error creating Solana wallet with passkey', result.error)
          setRecoveryError(new Error('Failed to create wallet'))
          setShouldCreate(false)
          return
        }
        setShouldCreate(false)
        clearPersistentOperation(client, operationKey)
        setRoute(routes.SOL_CONNECTED)
      } catch (err) {
        if (
          !observing ||
          !session.isCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentAttempt(attempt)
        )
          return
        clearPersistentOperation(client, operationKey)
        logger.log('Error creating Solana wallet with passkey', err)
        setRecoveryError(new Error('Failed to create wallet'))
        setShouldCreate(false)
      }
    })()
    return () => {
      observing = false
      cancelAttempt(attempt)
    }
  }, [
    active,
    shouldCreate,
    create,
    setRoute,
    beginAttempt,
    isCurrentAttempt,
    cancelAttempt,
    captureAuthSession,
    client,
    operationKey,
  ])

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
        onRetry={() => {
          setRecoveryError(null)
          setShouldCreate(true)
        }}
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
  const { active, beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
  const client = useOpenfortCore((state) => state.client)
  const { captureAuthSession } = useAuthTransitions()
  const operationLane = 'wallet-create:Solana'
  const operationKey = `${operationLane}:password`

  const observeCreation = useCallback(
    async (
      operation: PersistentOperation<Awaited<ReturnType<typeof embeddedWallet.create>>>,
      principalIsCurrent: () => boolean
    ) => {
      setLoading(true)
      const attempt = beginAttempt()
      try {
        const result = await operation.promise
        if (!principalIsCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
        clearPersistentOperation(client, operationKey)
        if (result.error) {
          setRecoveryError(result.error.message)
          return
        }
        setRoute(routes.SOL_CONNECTED)
      } catch (err) {
        if (
          !principalIsCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentAttempt(attempt)
        )
          return
        clearPersistentOperation(client, operationKey)
        setRecoveryError(err instanceof OpenfortError ? err.message : 'Failed to create wallet. Please try again.')
      } finally {
        if (principalIsCurrent() && isCurrentAttempt(attempt)) setLoading(false)
      }
    },
    [beginAttempt, client, isCurrentAttempt, operationKey, setRoute]
  )

  const handleSubmit = () => {
    if (getPasswordStrength(recoveryPhrase) < MEDIUM_SCORE_THRESHOLD) {
      setShowPasswordIsTooWeakError(true)
      return
    }

    const authSession = captureAuthSession()
    const existing = getPersistentOperation<Awaited<ReturnType<typeof embeddedWallet.create>>>(client, operationKey)
    const operation =
      existing ??
      getOrCreatePersistentOperation({
        owner: client,
        key: operationKey,
        lane: operationLane,
        principalIsCurrent: authSession.isCurrent,
        start: () =>
          embeddedWallet.create({
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: recoveryPhrase,
          }),
      })
    void observeCreation(operation, authSession.isCurrent)
  }

  useEffect(() => {
    if (!active) return
    const existing = getPersistentOperation<Awaited<ReturnType<typeof embeddedWallet.create>>>(client, operationKey)
    if (!existing) return
    const authSession = captureAuthSession()
    void observeCreation(existing, authSession.isCurrent)
  }, [active, captureAuthSession, client, observeCreation, operationKey])

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
            disabled={loading}
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
          <Button type="submit" waiting={loading} disabled={loading}>
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
