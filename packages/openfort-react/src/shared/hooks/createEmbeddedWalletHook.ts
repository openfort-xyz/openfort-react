'use client'

import { ChainTypeEnum, type EmbeddedAccount, EmbeddedState, type Openfort } from '@openfort/openfort-js'
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { EmbeddedAccountRequest } from '../../actions/createEmbeddedWallet.js'
import { createEmbeddedWallet } from '../../actions/createEmbeddedWallet.js'
import { exportPrivateKey } from '../../actions/exportPrivateKey.js'
import { findEmbeddedAccount } from '../../actions/findEmbeddedAccount.js'
import { importEmbeddedWallet } from '../../actions/importEmbeddedWallet.js'
import { setActiveWallet } from '../../actions/setActiveWallet.js'
import { setRecoveryMethod } from '../../actions/setRecoveryMethod.js'
import type { OpenfortWalletConfig } from '../../components/Openfort/types.js'
import { useOpenfortConfig, useOpenfortRouting } from '../../components/Openfort/useOpenfort.js'
import { asOpenfortError } from '../../errors/base.js'
import {
  ProviderNotReadyError,
  RecoveryError,
  SetActiveWalletError,
  WalletCreationError,
  WalletError,
  WalletImportError,
} from '../../errors/wallet.js'
import type { WalletFlowStatus } from '../../hooks/openfort/walletTypes.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { formatAddress } from '../../utils/format.js'
import { logger } from '../../utils/logger.js'
import type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
  ExportPrivateKeyOptions,
  ExportPrivateKeyResult,
  ImportEmbeddedWalletOptions,
  SetActiveEmbeddedWalletOptionsBase,
  SetActiveEmbeddedWalletResult,
  SetRecoveryOptions,
  SetRecoveryResult,
  WalletStatus,
} from '../types.js'
import { assertActiveEmbeddedAccount, type EmbeddedAccountIdentity } from '../utils/assertActiveEmbeddedAccount.js'
import {
  type EmbeddedSignerOperationContext,
  reserveEmbeddedSignerPublication,
  runEmbeddedSignerOperation,
} from '../utils/embeddedSignerOperationQueue.js'
import { buildEmbeddedWalletStatusResult } from '../utils/embeddedWalletStatusMapper.js'
import { toConnectedStateProperties } from '../utils/walletStatusProps.js'

/** Local state both embedded-wallet hooks track between renders. */
export type EmbeddedWalletInternalState<TWallet, TProvider> = {
  status: WalletStatus
  activeWallet: TWallet | null
  provider: TProvider | null
  error: string | null
}

/** Everything a chain's sync effect reads or writes. */
export type EmbeddedWalletSyncParameters<TWallet, TProvider> = {
  client: Openfort
  /** Embedded accounts belonging to this chain. */
  accounts: EmbeddedAccount[]
  /** The core store's single source of truth for the active wallet. */
  activeEmbeddedAddress: string | undefined
  embeddedState: EmbeddedState
  isLoadingAccounts: boolean
  /** Chain the modal is currently routed to, which may differ from this hook's chain. */
  routedChainType: ChainTypeEnum
  state: EmbeddedWalletInternalState<TWallet, TProvider>
  setState: Dispatch<SetStateAction<EmbeddedWalletInternalState<TWallet, TProvider>>>
  setActiveInProgressRef: RefObject<Promise<unknown> | null>
  /** Runs work that must not overlap another operation on this client's signer. */
  runSignerOperation: <T>(operation: (context: EmbeddedSignerOperationContext) => Promise<T>) => Promise<T>
  /** Builds (or fetches) this chain's provider for an account. */
  getProvider: (account: EmbeddedAccount, context: EmbeddedSignerOperationContext) => Promise<TProvider>
  setActiveEmbeddedAddress: (address: string | undefined) => void
}

/** Chain-specific values read from React context and options. */
export type EmbeddedWalletChainBindings = {
  /**
   * Resolves `accountType` (and `chainId` where the account type needs one) for
   * create and import. Must be referentially stable: it feeds the `create` and
   * `import` callback identities.
   */
  buildAccountRequest: (options: CreateEmbeddedWalletOptions | undefined) => EmbeddedAccountRequest
  /** Extra chain-specific fields merged into the hook result. */
  resultProps: Record<string, unknown>
}

/** Provider placeholder used while an embedded wallet is still recovering. */
export async function rejectUnreadyProvider(): Promise<never> {
  throw new ProviderNotReadyError()
}

type EmbeddedWalletHookConfig<TWallet extends { address: string }, TProvider, TOptions> = {
  /** Chain whose embedded accounts this hook exposes. */
  chainType: ChainTypeEnum
  /** Chain name used in wallet error messages. */
  chainName: 'Ethereum' | 'Solana'
  /**
   * Canonical form used for every address comparison on this chain. EVM
   * addresses are case-insensitive so they lowercase; Solana addresses are
   * base58 and compare verbatim.
   */
  normalizeAddress: (address: string) => string
  /** Builds this chain's provider, bound to `account` where the chain needs it. */
  buildProvider: (parameters: {
    client: Openfort
    account: EmbeddedAccount
    ethereumRpcUrls: NonNullable<OpenfortWalletConfig['ethereum']>['rpcUrls'] | undefined
    assertCurrent: () => void
  }) => Promise<TProvider>
  /** Maps this chain's accounts to the `wallets` list the hook exposes. */
  buildWallets: (parameters: {
    accounts: EmbeddedAccount[]
    getProvider: (account: EmbeddedAccount) => Promise<TProvider>
    status: WalletStatus
    activeWallet: TWallet | null
  }) => TWallet[]
  /** Builds the connected wallet once a provider is ready. */
  buildActiveWallet: (parameters: { account: EmbeddedAccount; walletIndex: number; provider: TProvider }) => TWallet
  /** Builds the placeholder wallet exposed while `setActive` is still recovering. */
  buildConnectingWallet: (parameters: { account: EmbeddedAccount; walletIndex: number }) => TWallet
  /** Store status published while this chain's `setActive` is in flight. */
  buildConnectingStatus: (wallet: TWallet) => WalletFlowStatus
  /** Reads the chain's React context and hook options. */
  useChainBindings: (options: TOptions | undefined) => EmbeddedWalletChainBindings
  /** Reconciles local state with the core store's `activeEmbeddedAddress`. */
  useSyncActiveWallet: (parameters: EmbeddedWalletSyncParameters<TWallet, TProvider>) => void
}

const INITIAL_STATE = { status: 'disconnected', activeWallet: null, provider: null, error: null } as const

function notifyConsumer<T>(callback: ((value: T) => unknown) | undefined, value: T): void {
  if (!callback) return
  try {
    void Promise.resolve(callback(value)).catch((error) => {
      logger.error('[embedded-wallet] callback rejected', error)
    })
  } catch (error) {
    logger.error('[embedded-wallet] callback threw', error)
  }
}

function captureActiveAccountIdentity(
  accounts: EmbeddedAccount[] | null | undefined,
  activeAddress: string | null | undefined,
  chainType: ChainTypeEnum
): EmbeddedAccountIdentity | null {
  if (!activeAddress) return null
  const account = accounts?.find((candidate) => {
    if (candidate.chainType !== chainType) return false
    if (candidate.chainType === ChainTypeEnum.EVM) {
      return candidate.address.toLowerCase() === activeAddress.toLowerCase()
    }
    return candidate.address === activeAddress
  })
  return account
    ? { id: account.id, address: account.address, chainType: account.chainType }
    : { address: activeAddress, chainType }
}

/**
 * Builds an embedded-wallet hook for one chain.
 *
 * The returned hook owns everything both chains share — store subscriptions,
 * local status state, the create/import/setActive/setRecovery/exportPrivateKey
 * actions, and the derived result shape — while the chain supplies provider
 * construction, address normalization, wallet shapes and its sync effect.
 *
 * @param config - Chain-specific behaviour injected into the shared hook body.
 * @returns A React hook returning this chain's wallet state.
 */
export function createEmbeddedWalletHook<TWallet extends { address: string }, TProvider, TOptions, TResult>(
  config: EmbeddedWalletHookConfig<TWallet, TProvider, TOptions>
): (options?: TOptions) => TResult {
  const {
    chainType,
    chainName,
    normalizeAddress,
    buildProvider,
    buildWallets,
    buildActiveWallet,
    buildConnectingWallet,
    buildConnectingStatus,
    useChainBindings,
    useSyncActiveWallet,
  } = config

  return function useEmbeddedWallet(options?: TOptions): TResult {
    const client = useOpenfortCore((s) => s.client)
    const embeddedAccounts = useOpenfortCore((s) => s.embeddedAccounts)
    const embeddedState = useOpenfortCore((s) => s.embeddedState)
    const isLoadingAccounts = useOpenfortCore((s) => s.isLoadingAccounts)
    const activeEmbeddedAddress = useOpenfortCore((s) => s.activeEmbeddedAddress)
    const updateEmbeddedAccounts = useOpenfortCore((s) => s.updateEmbeddedAccounts)
    const setActiveEmbeddedAddress = useOpenfortCore((s) => s.setActiveEmbeddedAddress)
    const setEmbeddedState = useOpenfortCore((s) => s.setEmbeddedState)
    const setWalletStatus = useOpenfortCore((s) => s.setWalletStatus)
    const { walletConfig } = useOpenfortConfig()
    const ethereumRpcUrls = walletConfig?.ethereum?.rpcUrls
    const { chainType: routedChainType } = useOpenfortRouting()

    const { buildAccountRequest, resultProps } = useChainBindings(options)

    const setActiveInProgressRef = useRef<Promise<unknown> | null>(null)
    const latestLocalWalletMutationRef = useRef(0)
    const accountsRef = useRef<EmbeddedAccount[]>([])

    const [state, setState] = useState<EmbeddedWalletInternalState<TWallet, TProvider>>(INITIAL_STATE)
    const stateRef = useRef(state)
    stateRef.current = state
    const exposedState: EmbeddedWalletInternalState<TWallet, TProvider> =
      state.status === 'connected' && embeddedState !== EmbeddedState.READY
        ? { ...state, status: 'reconnecting', provider: null }
        : state

    const accounts = useMemo(() => {
      if (!embeddedAccounts) return []
      return embeddedAccounts.filter((acc) => acc.chainType === chainType)
    }, [embeddedAccounts])
    accountsRef.current = accounts

    const getProvider = useCallback(
      (account: EmbeddedAccount, { assertCurrent }: EmbeddedSignerOperationContext): Promise<TProvider> =>
        buildProvider({ client, account, ethereumRpcUrls, assertCurrent }),
      [client, ethereumRpcUrls]
    )
    const runSignerOperation = useCallback(
      <T>(operation: (context: EmbeddedSignerOperationContext) => Promise<T>) =>
        runEmbeddedSignerOperation(client, operation),
      [client]
    )
    const getSerializedProvider = useCallback(
      (account: EmbeddedAccount): Promise<TProvider> => runSignerOperation((context) => getProvider(account, context)),
      [getProvider, runSignerOperation]
    )

    const wallets = useMemo(
      () =>
        buildWallets({
          accounts,
          getProvider: getSerializedProvider,
          status: exposedState.status,
          activeWallet: exposedState.activeWallet,
        }),
      [accounts, getSerializedProvider, exposedState.status, exposedState.activeWallet]
    )

    // The store holds one wallet status for the active chain. Publishing it only while
    // this hook's chain is routed keeps the other chain's mounted hook from overwriting it.
    useEffect(() => {
      if (routedChainType !== chainType) return
      if (state.status === 'creating') {
        setWalletStatus({ status: 'creating' })
      } else if (state.status === 'connecting' && state.activeWallet) {
        setWalletStatus(buildConnectingStatus(state.activeWallet))
      } else {
        setWalletStatus({ status: 'idle' })
      }
    }, [routedChainType, state.status, state.activeWallet, setWalletStatus])

    /** Moves to `connected` and caches the provider for the freshly minted account. */
    const settleNewAccount = useCallback(
      async (account: EmbeddedAccount, assertCurrent: () => void, shouldPublish: () => boolean) => {
        assertCurrent()
        if (!shouldPublish()) return
        const provider = await getProvider(account, { assertCurrent })
        const activeWallet = buildActiveWallet({ account, walletIndex: 0, provider })
        assertCurrent()
        if (!shouldPublish()) return
        setState({ status: 'connected', activeWallet, provider, error: null })
      },
      [getProvider]
    )

    const create = useCallback(
      async (createOptions?: CreateEmbeddedWalletOptions): Promise<CreateEmbeddedWalletResult> => {
        const localInvocation = ++latestLocalWalletMutationRef.current
        const previousState = stateRef.current
        const shouldPublish = reserveEmbeddedSignerPublication(client)
        const restoreIfSupersededElsewhere = () => {
          if (!shouldPublish() && latestLocalWalletMutationRef.current === localInvocation) setState(previousState)
        }
        setState((s) => ({ ...s, status: 'creating', error: null }))

        try {
          const account = await runSignerOperation(async ({ assertCurrent }) => {
            const createdAccount = await createEmbeddedWallet({
              client,
              walletConfig,
              chainType,
              accountRequest: buildAccountRequest(createOptions),
              recovery: createOptions,
              assertCurrent,
              shouldPublish,
              setActiveEmbeddedAddress,
              updateEmbeddedAccounts,
            })

            await settleNewAccount(createdAccount, assertCurrent, shouldPublish)
            return createdAccount
          })

          const result = { account }
          if (shouldPublish()) notifyConsumer(createOptions?.onSuccess, result)
          else restoreIfSupersededElsewhere()
          return result
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new WalletCreationError({ chain: chainName, cause }))

          if (shouldPublish()) {
            setState((s) => ({ ...s, status: 'error', error: error.message }))
            notifyConsumer(createOptions?.onError, error)
          } else restoreIfSupersededElsewhere()
          return { error }
        }
      },
      [
        client,
        walletConfig,
        buildAccountRequest,
        settleNewAccount,
        updateEmbeddedAccounts,
        setActiveEmbeddedAddress,
        runSignerOperation,
      ]
    )

    const importWallet = useCallback(
      async (importOptions: ImportEmbeddedWalletOptions): Promise<CreateEmbeddedWalletResult> => {
        const localInvocation = ++latestLocalWalletMutationRef.current
        const previousState = stateRef.current
        const shouldPublish = reserveEmbeddedSignerPublication(client)
        const restoreIfSupersededElsewhere = () => {
          if (!shouldPublish() && latestLocalWalletMutationRef.current === localInvocation) setState(previousState)
        }
        setState((s) => ({ ...s, status: 'creating', error: null }))

        try {
          const account = await runSignerOperation(async ({ assertCurrent }) => {
            const importedAccount = await importEmbeddedWallet({
              client,
              walletConfig,
              chainType,
              accountRequest: buildAccountRequest(importOptions),
              recovery: importOptions,
              privateKey: importOptions.privateKey,
              assertCurrent,
              shouldPublish,
              setActiveEmbeddedAddress,
              updateEmbeddedAccounts,
            })

            await settleNewAccount(importedAccount, assertCurrent, shouldPublish)
            return importedAccount
          })

          const result = { account }
          if (shouldPublish()) notifyConsumer(importOptions.onSuccess, result)
          else restoreIfSupersededElsewhere()
          return result
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new WalletImportError({ chain: chainName, cause }))

          if (shouldPublish()) {
            setState((s) => ({ ...s, status: 'error', error: error.message }))
            notifyConsumer(importOptions.onError, error)
          } else restoreIfSupersededElsewhere()
          return { error }
        }
      },
      [
        client,
        walletConfig,
        buildAccountRequest,
        settleNewAccount,
        updateEmbeddedAccounts,
        setActiveEmbeddedAddress,
        runSignerOperation,
      ]
    )

    const setActive = useCallback(
      async (
        activeOptions: SetActiveEmbeddedWalletOptionsBase & { address: string }
      ): Promise<SetActiveEmbeddedWalletResult> => {
        const localInvocation = ++latestLocalWalletMutationRef.current
        const previousState = stateRef.current
        const shouldPublish = reserveEmbeddedSignerPublication(client)
        const restoreIfSupersededElsewhere = () => {
          if (!shouldPublish() && latestLocalWalletMutationRef.current === localInvocation) setState(previousState)
        }
        type SetActiveSettlement =
          | { status: 'needs-recovery'; result: { needsRecovery: true } }
          | {
              status: 'connected'
              result: { needsRecovery: false }
              account: EmbeddedAccount
              activeWallet: TWallet
              provider: TProvider
            }

        const run = async ({ assertCurrent }: EmbeddedSignerOperationContext): Promise<SetActiveSettlement> => {
          const currentAccounts = accountsRef.current
          const account = findEmbeddedAccount({
            accounts: currentAccounts,
            address: activeOptions.address,
            normalizeAddress,
          })
          const walletIndex = currentAccounts.indexOf(account)

          if (shouldPublish()) {
            setState((s) => ({
              ...s,
              status: 'connecting',
              activeWallet: buildConnectingWallet({ account, walletIndex }),
              error: null,
            }))
          }

          const { needsRecovery } = await setActiveWallet({
            client,
            walletConfig,
            account,
            options: activeOptions,
            assertCurrent,
          })
          if (needsRecovery) {
            return { status: 'needs-recovery' as const, result: { needsRecovery: true } as const }
          }

          assertCurrent()
          const provider = await getProvider(account, { assertCurrent })
          const activeWallet = buildActiveWallet({ account, walletIndex, provider })
          return {
            status: 'connected' as const,
            result: { needsRecovery: false } as const,
            account,
            activeWallet,
            provider,
          }
        }

        // The client-scoped queue also covers provider synchronization from other
        // hook instances, so signer replacement and provider reads cannot overlap.
        const promise = runSignerOperation(run)
        setActiveInProgressRef.current = promise
        try {
          const settlement = await promise
          if (shouldPublish()) {
            if (settlement.status === 'connected') {
              setEmbeddedState(EmbeddedState.READY)
              setState({
                status: 'connected',
                activeWallet: settlement.activeWallet,
                provider: settlement.provider,
                error: null,
              })
              setActiveEmbeddedAddress(settlement.account.address)
            } else {
              setState((s) => ({ ...s, status: 'needs-recovery', error: null }))
            }
            notifyConsumer(activeOptions.onSuccess, settlement.result)
          } else restoreIfSupersededElsewhere()
          return settlement.result
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new SetActiveWalletError({ chain: chainName, cause }))

          if (shouldPublish()) {
            setState((s) => ({ ...s, status: 'error', error: error.message }))
            notifyConsumer(activeOptions.onError, error)
          } else restoreIfSupersededElsewhere()
          return { error }
        } finally {
          if (setActiveInProgressRef.current === promise) setActiveInProgressRef.current = null
        }
      },
      [client, walletConfig, getProvider, setActiveEmbeddedAddress, setEmbeddedState, runSignerOperation]
    )

    const setRecovery = useCallback(
      async (recoveryOptions: SetRecoveryOptions): Promise<SetRecoveryResult> => {
        const intendedAccount = captureActiveAccountIdentity(embeddedAccounts, activeEmbeddedAddress, chainType)
        try {
          await runSignerOperation(async ({ assertCurrent }) => {
            const currentAccount = await client.embeddedWallet.get()
            assertCurrent()
            assertActiveEmbeddedAccount(intendedAccount, currentAccount)
            assertCurrent()
            await setRecoveryMethod({
              client,
              previousRecovery: recoveryOptions.previousRecovery,
              newRecovery: recoveryOptions.newRecovery,
              updateEmbeddedAccounts,
            })
          })
          const result = {}
          notifyConsumer(recoveryOptions.onSuccess, result)
          return result
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new RecoveryError('Failed to set recovery method.', { cause }))
          setState((s) => ({ ...s, status: 'error', error: error.message }))
          notifyConsumer(recoveryOptions.onError, error)
          return { error }
        }
      },
      [client, embeddedAccounts, activeEmbeddedAddress, updateEmbeddedAccounts, runSignerOperation]
    )

    const exportKey = useCallback(
      async (exportOptions?: ExportPrivateKeyOptions): Promise<ExportPrivateKeyResult> => {
        const intendedAccount = captureActiveAccountIdentity(embeddedAccounts, activeEmbeddedAddress, chainType)
        try {
          const privateKey = await runSignerOperation(async ({ assertCurrent }) => {
            const currentAccount = await client.embeddedWallet.get()
            assertCurrent()
            assertActiveEmbeddedAccount(intendedAccount, currentAccount)
            assertCurrent()
            return exportPrivateKey({ client })
          })
          const result = { privateKey }
          notifyConsumer(exportOptions?.onSuccess, result)
          return result
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new WalletError('Failed to export private key.', { cause }))
          setState((s) => ({ ...s, status: 'error', error: error.message }))
          notifyConsumer(exportOptions?.onError, error)
          return { error }
        }
      },
      [client, embeddedAccounts, activeEmbeddedAddress, runSignerOperation]
    )

    const actions = useMemo(
      () => ({
        create,
        import: importWallet,
        wallets,
        setActive,
        setRecovery,
        exportPrivateKey: exportKey,
      }),
      [create, importWallet, wallets, setActive, setRecovery, exportKey]
    )

    useSyncActiveWallet({
      client,
      accounts,
      activeEmbeddedAddress,
      embeddedState,
      isLoadingAccounts,
      routedChainType,
      state,
      setState,
      setActiveInProgressRef,
      runSignerOperation,
      getProvider,
      setActiveEmbeddedAddress,
    })

    const derived = {
      isLoading:
        exposedState.status === 'fetching-wallets' ||
        exposedState.status === 'connecting' ||
        exposedState.status === 'creating' ||
        exposedState.status === 'reconnecting',
      isError: exposedState.status === 'error',
      isSuccess: exposedState.status === 'connected',
    }
    const connectedStateProps = toConnectedStateProperties(exposedState.status, exposedState.activeWallet)
    const displayAddress =
      exposedState.activeWallet?.address &&
      (exposedState.status === 'connected' ||
        exposedState.status === 'connecting' ||
        exposedState.status === 'reconnecting')
        ? formatAddress(exposedState.activeWallet.address, chainType)
        : undefined

    if (isLoadingAccounts) {
      return {
        ...actions,
        status: 'fetching-wallets',
        activeWallet: null,
        isLoading: true,
        isError: false,
        isSuccess: false,
        embeddedWalletId: undefined,
        isConnected: false,
        isConnecting: true,
        isDisconnected: false,
        isReconnecting: false,
      } as TResult
    }

    return {
      ...buildEmbeddedWalletStatusResult(exposedState, actions),
      ...derived,
      ...connectedStateProps,
      ...(displayAddress && { displayAddress }),
      ...(exposedState.activeWallet?.address && { address: exposedState.activeWallet.address }),
      ...resultProps,
    } as TResult
  }
}
