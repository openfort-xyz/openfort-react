'use client'

import type { ChainTypeEnum, EmbeddedAccount, EmbeddedState, Openfort } from '@openfort/openfort-js'
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  SetActiveWalletError,
  WalletCreationError,
  WalletImportError,
} from '../../errors/wallet.js'
import type { WalletFlowStatus } from '../../hooks/openfort/walletTypes.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { formatAddress } from '../../utils/format.js'
import type {
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetActiveEmbeddedWalletOptionsBase,
  SetRecoveryOptions,
  WalletStatus,
} from '../types.js'
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
  /** Builds (or fetches) this chain's provider for an account. */
  getProvider: (account: EmbeddedAccount) => Promise<TProvider>
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
    const setWalletStatus = useOpenfortCore((s) => s.setWalletStatus)
    const { walletConfig } = useOpenfortConfig()
    const ethereumRpcUrls = walletConfig?.ethereum?.rpcUrls
    const { chainType: routedChainType } = useOpenfortRouting()

    const { buildAccountRequest, resultProps } = useChainBindings(options)

    const setActiveInProgressRef = useRef<Promise<void> | null>(null)
    const accountsRef = useRef<EmbeddedAccount[]>([])

    const [state, setState] = useState<EmbeddedWalletInternalState<TWallet, TProvider>>(INITIAL_STATE)

    const accounts = useMemo(() => {
      if (!embeddedAccounts) return []
      return embeddedAccounts.filter((acc) => acc.chainType === chainType)
    }, [embeddedAccounts])
    accountsRef.current = accounts

    const getProvider = useCallback(
      (account: EmbeddedAccount): Promise<TProvider> => buildProvider({ client, account, ethereumRpcUrls }),
      [client, ethereumRpcUrls]
    )

    const wallets = useMemo(
      () => buildWallets({ accounts, getProvider, status: state.status, activeWallet: state.activeWallet }),
      [accounts, getProvider, state.status, state.activeWallet]
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
      async (account: EmbeddedAccount) => {
        const provider = await getProvider(account)
        const activeWallet = buildActiveWallet({ account, walletIndex: 0, provider })
        setState({ status: 'connected', activeWallet, provider, error: null })
      },
      [getProvider]
    )

    const create = useCallback(
      async (createOptions?: CreateEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
        setState((s) => ({ ...s, status: 'creating', error: null }))

        try {
          const account = await createEmbeddedWallet({
            client,
            walletConfig,
            chainType,
            accountRequest: buildAccountRequest(createOptions),
            recovery: createOptions,
            setActiveEmbeddedAddress,
            updateEmbeddedAccounts,
          })

          await settleNewAccount(account)

          createOptions?.onSuccess?.({ account })
          return account
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new WalletCreationError({ chain: chainName, cause }))

          setState((s) => ({ ...s, status: 'error', error: error.message }))

          createOptions?.onError?.(error)
          throw error
        }
      },
      [client, walletConfig, buildAccountRequest, settleNewAccount, updateEmbeddedAccounts, setActiveEmbeddedAddress]
    )

    const importWallet = useCallback(
      async (importOptions: ImportEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
        setState((s) => ({ ...s, status: 'creating', error: null }))

        try {
          const account = await importEmbeddedWallet({
            client,
            walletConfig,
            chainType,
            accountRequest: buildAccountRequest(importOptions),
            recovery: importOptions,
            privateKey: importOptions.privateKey,
            setActiveEmbeddedAddress,
            updateEmbeddedAccounts,
          })

          await settleNewAccount(account)

          importOptions.onSuccess?.({ account })
          return account
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new WalletImportError({ chain: chainName, cause }))

          setState((s) => ({ ...s, status: 'error', error: error.message }))

          importOptions.onError?.(error)
          throw error
        }
      },
      [client, walletConfig, buildAccountRequest, settleNewAccount, updateEmbeddedAccounts, setActiveEmbeddedAddress]
    )

    const setActive = useCallback(
      async (activeOptions: SetActiveEmbeddedWalletOptionsBase & { address: string }): Promise<void> => {
        const run = async (): Promise<void> => {
          const currentAccounts = accountsRef.current
          const account = findEmbeddedAccount({
            accounts: currentAccounts,
            address: activeOptions.address,
            normalizeAddress,
          })
          const walletIndex = currentAccounts.indexOf(account)

          setState((s) => ({
            ...s,
            status: 'connecting',
            activeWallet: buildConnectingWallet({ account, walletIndex }),
            error: null,
          }))

          try {
            const { needsRecovery } = await setActiveWallet({
              client,
              walletConfig,
              account,
              options: activeOptions,
            })
            if (needsRecovery) {
              setState((s) => ({ ...s, status: 'needs-recovery', error: null }))
              return
            }

            const provider = await getProvider(account)
            const activeWallet = buildActiveWallet({ account, walletIndex, provider })

            setState({ status: 'connected', activeWallet, provider, error: null })
            setActiveEmbeddedAddress(account.address)
          } catch (err) {
            const error = asOpenfortError(err, (cause) => new SetActiveWalletError({ chain: chainName, cause }))

            setState((s) => ({ ...s, status: 'error', error: error.message }))

            throw error
          }
        }

        const prev = setActiveInProgressRef.current
        if (prev) {
          try {
            await prev
          } catch {
            /* ignore previous operation's error */
          }
        }
        const promise = run()
        setActiveInProgressRef.current = promise
        try {
          await promise
        } finally {
          if (setActiveInProgressRef.current === promise) setActiveInProgressRef.current = null
        }
      },
      [client, walletConfig, getProvider, setActiveEmbeddedAddress]
    )

    const setRecovery = useCallback(
      async (recoveryOptions: SetRecoveryOptions): Promise<void> => {
        await setRecoveryMethod({
          client,
          previousRecovery: recoveryOptions.previousRecovery,
          newRecovery: recoveryOptions.newRecovery,
          updateEmbeddedAccounts,
        })
      },
      [client, updateEmbeddedAccounts]
    )

    const exportKey = useCallback(async (): Promise<string> => exportPrivateKey({ client }), [client])

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
      getProvider,
      setActiveEmbeddedAddress,
    })

    const derived = useMemo(
      () => ({
        isLoading:
          state.status === 'fetching-wallets' ||
          state.status === 'connecting' ||
          state.status === 'creating' ||
          state.status === 'reconnecting',
        isError: state.status === 'error',
        isSuccess: state.status === 'connected',
      }),
      [state.status]
    )

    const connectedStateProps = useMemo(
      () => toConnectedStateProperties(state.status, state.activeWallet),
      [state.status, state.activeWallet]
    )

    const displayAddress = useMemo(
      () =>
        state.activeWallet?.address && (state.status === 'connected' || state.status === 'connecting')
          ? formatAddress(state.activeWallet.address, chainType)
          : undefined,
      [state.activeWallet?.address, state.status]
    )

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
      ...buildEmbeddedWalletStatusResult(state, actions),
      ...derived,
      ...connectedStateProps,
      ...(displayAddress && { displayAddress }),
      ...(state.activeWallet?.address && { address: state.activeWallet.address }),
      ...resultProps,
    } as TResult
  }
}
