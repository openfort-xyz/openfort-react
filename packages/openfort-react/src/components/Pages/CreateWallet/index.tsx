'use client'

import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { motion } from 'framer-motion'
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FingerPrintIcon, KeyIcon, LockIcon, PlusIcon, ShieldIcon } from '../../../assets/icons.js'
import Logos from '../../../assets/logos.js'
import { OpenfortError } from '../../../errors/base.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
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
import { withPageLoading } from '../../ConnectModal/pageLoading.js'
import { FloatingGraphic } from '../../FloatingGraphic/index.js'
import { LinkWalletOnSignUpOption, routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent, type SetOnBackFunction } from '../../PageContent/index.js'
import { PasswordStrengthIndicator } from '../../PasswordStrength/PasswordStrengthIndicator.js'
import { getPasswordStrength, MEDIUM_SCORE_THRESHOLD } from '../../PasswordStrength/password-utility.js'
import { ProviderIcon, ProviderLabel, ProvidersButton } from '../Providers/styles.js'
import { useLatestAsyncAttempt } from '../useLatestAsyncAttempt.js'
import AutomaticRecoveryOtpPage from './AutomaticRecoveryOtpPage.js'
import SolanaCreateWallet from './SolanaCreateWallet.js'
import { OtherMethodButton } from './styles.js'
import { useAutomaticRecovery } from './useAutomaticRecovery.js'

// External wallet connection is a config-dependent branch most sessions never
// reach, and it is the only wagmi-backed page routed to from here.
const LazyConnectors = lazy(() => import('../../../wagmi/components/Connectors/index.js'))

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
  const embeddedState = useOpenfortCore((s) => s.embeddedState)
  const isLoadingAccounts = useOpenfortCore((s) => s.isLoadingAccounts)
  const { walletConfig } = useOpenfort()
  const { create } = useEthereumEmbeddedWallet()
  const hasAttemptedCreationRef = useRef(false)

  const recovery = useAutomaticRecovery({
    chain: 'Ethereum',
    create,
    successRoute: routes.CONNECTED_SUCCESS,
    otpVerificationError: 'There was an error verifying the OTP',
    canCreate: !isLoadingAccounts,
  })
  const { startCreation } = recovery

  /** Clears the single-attempt guard and asks for a fresh creation attempt. */
  const retry = () => {
    hasAttemptedCreationRef.current = false
    startCreation()
  }

  useEffect(() => {
    if (embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (walletConfig?.connectOnLogin === false) return
    // Guard against retry loop: when create() fails the SDK cycles the
    // embeddedState back to EMBEDDED_SIGNER_NOT_CONFIGURED which re-triggers
    // this effect.  Only attempt creation once — the user can retry manually.
    if (hasAttemptedCreationRef.current) return
    hasAttemptedCreationRef.current = true
    startCreation()
  }, [embeddedState, walletConfig?.connectOnLogin, startCreation])

  if (recovery.needsOTP) {
    return <AutomaticRecoveryOtpPage recovery={recovery} onBack={onBack} logoutOnBack={logoutOnBack} />
  }

  // When connectOnLogin is false, auto-creation is skipped — show a manual
  // trigger instead of an infinite spinner.
  if (!recovery.shouldCreate && !recovery.recoveryError) {
    return (
      <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
        <ModalHeading>Create wallet</ModalHeading>
        <ModalBody style={{ textAlign: 'center' }}>Create an embedded wallet to get started.</ModalBody>
        <Button onClick={retry}>Create wallet</Button>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <Loader
        isError={!!recovery.recoveryError}
        header={recovery.recoveryError ? 'Error creating wallet.' : 'Creating wallet...'}
        description={recovery.recoveryError ? recovery.recoveryError.message : undefined}
        onRetry={recovery.recoveryError ? retry : undefined}
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
  const hasAttemptedCreationRef = useRef(false)
  const [recoveryError, setRecoveryError] = useState<Error | null>(null)
  const embeddedState = useOpenfortCore((s) => s.embeddedState)
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession } = useAuthTransitions()
  const operationLane = 'wallet-create:Ethereum'
  const operationKey = `${operationLane}:passkey`
  const { active, beginAttempt, isCurrentAttempt, cancelAttempt } = useLatestAsyncAttempt()

  useEffect(() => {
    if (!active || !shouldCreateWallet) return
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
      logger.log('Creating wallet passkey recovery')
      try {
        const result = await operation.promise
        if (!observing || !session.isCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
        setShouldCreateWallet(false)
        if (result.error) {
          clearPersistentOperation(client, operationKey)
          logger.log('Error creating wallet', result.error)
          setRecoveryError(new Error('Failed to create wallet'))
          return
        }
        clearPersistentOperation(client, operationKey)
        setRoute(routes.CONNECTED_SUCCESS)
      } catch (err) {
        if (
          !observing ||
          !session.isCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentAttempt(attempt)
        )
          return
        clearPersistentOperation(client, operationKey)
        logger.log('Error creating wallet', err)
        setRecoveryError(new Error('Failed to create wallet'))
        setShouldCreateWallet(false)
      }
    })()
    return () => {
      observing = false
      cancelAttempt(attempt)
    }
  }, [
    active,
    shouldCreateWallet,
    create,
    setRoute,
    beginAttempt,
    isCurrentAttempt,
    cancelAttempt,
    captureAuthSession,
    client,
    operationKey,
  ])

  useEffect(() => {
    if (embeddedState !== EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) return
    if (walletConfig?.connectOnLogin === false) return
    if (hasAttemptedCreationRef.current) return
    hasAttemptedCreationRef.current = true
    setShouldCreateWallet(true)
  }, [embeddedState, walletConfig?.connectOnLogin])

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
          setShouldCreateWallet(true)
        }}
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
  const { active, beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
  const client = useOpenfortCore((state) => state.client)
  const { captureAuthSession } = useAuthTransitions()
  const operationLane = 'wallet-create:Ethereum'
  const operationKey = `${operationLane}:password`

  const observeCreation = useCallback(
    async (operation: PersistentOperation<Awaited<ReturnType<typeof create>>>, principalIsCurrent: () => boolean) => {
      setLoading(true)
      const attempt = beginAttempt()
      try {
        const result = await operation.promise
        if (!principalIsCurrent() || !operation.isCurrent() || !isCurrentAttempt(attempt)) return
        clearPersistentOperation(client, operationKey)
        if (result.error) {
          setRecoveryError(result.error.shortMessage)
          return
        }
        logger.log('Recovery success')
        setRoute(routes.CONNECTED_SUCCESS)
      } catch (err) {
        if (
          !principalIsCurrent() ||
          (!operation.isCurrent() && !(err instanceof PersistentOperationLaneBusyError)) ||
          !isCurrentAttempt(attempt)
        )
          return
        clearPersistentOperation(client, operationKey)
        setRecoveryError(err instanceof OpenfortError ? err.shortMessage : 'There was an error recovering your account')
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
    const existing = getPersistentOperation<Awaited<ReturnType<typeof create>>>(client, operationKey)
    const operation =
      existing ??
      getOrCreatePersistentOperation({
        owner: client,
        key: operationKey,
        lane: operationLane,
        principalIsCurrent: authSession.isCurrent,
        start: () =>
          create({
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: recoveryPhrase,
          }),
      })
    // The phrase has been handed to the SDK; holding it in component state (and
    // therefore in the DOM) past that point serves nothing and keeps recovery
    // material alive for as long as the page is open.
    setRecoveryPhrase('')
    void observeCreation(operation, authSession.isCurrent)
  }

  useEffect(() => {
    if (!active) return
    const existing = getPersistentOperation<Awaited<ReturnType<typeof create>>>(client, operationKey)
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

const CreateEmbeddedWallet = ({ onBack, logoutOnBack }: { onBack: SetOnBackFunction; logoutOnBack: boolean }) => {
  const { uiConfig, triggerResize } = useOpenfort()
  const [userSelectedMethod, setUserSelectedMethod] = useState<RecoveryMethod | 'other' | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `userSelectedMethod` is the trigger — each recovery method renders a differently sized page
  useEffect(() => {
    triggerResize()
  }, [userSelectedMethod, triggerResize])

  const configuredDefault = uiConfig.walletRecovery.defaultMethod
  const method =
    userSelectedMethod ??
    (uiConfig.walletRecovery.allowedMethods.includes(configuredDefault)
      ? configuredDefault
      : (uiConfig.walletRecovery.allowedMethods[0] ?? RecoveryMethod.PASSWORD))
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
  const user = useOpenfortCore((s) => s.user)
  const chainType = useOpenfortCore((s) => s.chainType)

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
    return withPageLoading(<LazyConnectors logoutOnBack={true} />)
  }

  return <CreateEmbeddedWallet onBack={routes.PROVIDERS} logoutOnBack />
}

const createWalletByChain: Record<ChainTypeEnum.EVM | ChainTypeEnum.SVM, React.ReactElement> = {
  [ChainTypeEnum.EVM]: <EthereumCreateWallet />,
  [ChainTypeEnum.SVM]: <SolanaCreateWallet onBack={routes.PROVIDERS} logoutOnBack />,
}

const CreateWallet: React.FC = () => {
  const chainType = useOpenfortCore((s) => s.chainType)
  return createWalletByChain[chainType] ?? createWalletByChain[ChainTypeEnum.EVM]
}

export default CreateWallet
