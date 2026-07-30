'use client'

import { AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, EmbeddedState } from '@openfort/openfort-js'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenfortConfig, useOpenfortRouting } from '../../components/Openfort/useOpenfort.js'
import { asOpenfortError } from '../../errors/base.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import {
  ProviderNotReadyError,
  RecoveryError,
  SetActiveWalletError,
  WalletCreationError,
  WalletImportError,
  WalletNotFoundError,
} from '../../errors/wallet.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import type {
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetRecoveryOptions,
  WalletStatus,
} from '../../shared/types.js'
import { buildEmbeddedWalletStatusResult } from '../../shared/utils/embeddedWalletStatusMapper.js'
import { type BuildRecoveryParamsConfig, buildRecoveryParams } from '../../shared/utils/recovery.js'
import { toConnectedStateProperties } from '../../shared/utils/walletStatusProps.js'
import { formatAddress } from '../../utils/format.js'
import { getDefaultSolanaRpcUrl } from '../../utils/rpc.js'
import { getTransactionBytes } from '../operations.js'
import { createSolanaProvider } from '../provider.js'
import { SolanaContext } from '../SolanaContext.js'
import type {
  ConnectedEmbeddedSolanaWallet,
  OpenfortEmbeddedSolanaWalletProvider,
  SetActiveSolanaWalletOptions,
  SignedSolanaTransaction,
  SolanaCluster,
  SolanaTransaction,
  SolanaWalletState,
  UseEmbeddedSolanaWalletOptions,
} from '../types.js'
import { resolveRecoveryForSetActive } from './recoveryResolver.js'

type InternalState = {
  status: WalletStatus
  activeWallet: ConnectedEmbeddedSolanaWallet | null
  provider: OpenfortEmbeddedSolanaWalletProvider | null
  error: string | null
}

/**
 * Returns state for Solana embedded wallets: create, recover, list, active wallet, and provider.
 * Use for creating accounts, recovering existing ones, and signing transactions.
 *
 * @param options - Optional cluster override (like chainId on Ethereum) and recoveryParams
 * @returns State with status, wallets, activeWallet, create, recover, setActive, provider, cluster, rpcUrl
 *
 * @example
 * ```tsx
 * const solana = useSolanaEmbeddedWallet()
 * if (solana.status === 'connected' && solana.provider) {
 *   const sig = await solana.provider.signTransaction(tx)
 * }
 * ```
 */
export function useSolanaEmbeddedWallet(options?: UseEmbeddedSolanaWalletOptions): SolanaWalletState {
  const client = useOpenfortCore((s) => s.client)
  const embeddedAccounts = useOpenfortCore((s) => s.embeddedAccounts)
  const embeddedState = useOpenfortCore((s) => s.embeddedState)
  const isLoadingAccounts = useOpenfortCore((s) => s.isLoadingAccounts)
  const activeEmbeddedAddress = useOpenfortCore((s) => s.activeEmbeddedAddress)
  const updateEmbeddedAccounts = useOpenfortCore((s) => s.updateEmbeddedAccounts)
  const setActiveEmbeddedAddress = useOpenfortCore((s) => s.setActiveEmbeddedAddress)
  const setWalletStatus = useOpenfortCore((s) => s.setWalletStatus)
  const { walletConfig } = useOpenfortConfig()
  const { chainType } = useOpenfortRouting()

  const setActiveInProgressRef = useRef<Promise<void> | null>(null)
  const solanaAccountsRef = useRef<EmbeddedAccount[]>([])

  const [state, setState] = useState<InternalState>({
    status: 'disconnected',
    activeWallet: null,
    provider: null,
    error: null,
  })

  const solanaAccounts = useMemo(() => {
    if (!embeddedAccounts) return []
    return embeddedAccounts.filter((acc) => acc.chainType === ChainTypeEnum.SVM)
  }, [embeddedAccounts])
  solanaAccountsRef.current = solanaAccounts

  const createProviderForAccount = useCallback(
    (account: EmbeddedAccount): OpenfortEmbeddedSolanaWalletProvider => {
      return createSolanaProvider({
        account,
        signMessage: async (message: string): Promise<string> => {
          const signature = await client.embeddedWallet.signMessage(message, {
            hashMessage: false, // Ed25519 - no keccak256
          })
          return signature as string
        },
        signTransaction: async (transaction: SolanaTransaction): Promise<SignedSolanaTransaction> => {
          const messageBytes = getTransactionBytes(transaction)
          const signature = await client.embeddedWallet.signMessage(new Uint8Array(messageBytes), {
            hashMessage: false, // Ed25519 - no keccak256
          })
          return {
            signature: signature as string,
            publicKey: account.address,
          }
        },
        signAllTransactions: async (transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]> => {
          const results = await Promise.all(
            transactions.map(async (tx) => {
              const messageBytes = getTransactionBytes(tx)
              const signature = await client.embeddedWallet.signMessage(new Uint8Array(messageBytes), {
                hashMessage: false, // Ed25519 - no keccak256
              })
              return {
                signature: signature as string,
                publicKey: account.address,
              }
            })
          )
          return results
        },
      })
    },
    [client]
  )

  const wallets = useMemo<ConnectedEmbeddedSolanaWallet[]>(() => {
    return solanaAccounts.map((acc, index) => ({
      id: acc.id,
      address: acc.address,
      chainType: ChainTypeEnum.SVM,
      walletIndex: index,
      recoveryMethod: acc.recoveryMethod,
      getProvider: async () => createProviderForAccount(acc),
    }))
  }, [solanaAccounts, createProviderForAccount])

  // The store holds one wallet status for the active chain. Publishing it only while
  // Solana is active keeps a mounted Ethereum hook from overwriting this one, and vice versa.
  useEffect(() => {
    if (chainType !== ChainTypeEnum.SVM) return
    if (state.status === 'creating') {
      setWalletStatus({ status: 'creating' })
    } else if (state.status === 'connecting' && state.activeWallet) {
      setWalletStatus({ status: 'connecting' })
    } else {
      setWalletStatus({ status: 'idle' })
    }
  }, [chainType, state.status, state.activeWallet, setWalletStatus])

  const create = useCallback(
    async (createOptions?: CreateEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
      setState((s) => ({ ...s, status: 'creating', error: null }))

      try {
        if (!walletConfig) {
          throw new WalletConfigNotFoundError()
        }

        const recoveryParams = await buildRecoveryParams(
          {
            recoveryMethod: createOptions?.recoveryMethod,
            passkeyId: createOptions?.passkeyId,
            password: createOptions?.password,
            otpCode: createOptions?.otpCode,
          },
          {
            walletConfig,
            getAccessToken: () => client.getAccessToken(),
            getUserId: () => client.user.get().then((u) => u?.id),
          }
        )

        const account = await client.embeddedWallet.create({
          chainType: ChainTypeEnum.SVM,
          accountType: AccountTypeEnum.EOA,
          recoveryParams,
        })

        setActiveEmbeddedAddress(account.address)
        await updateEmbeddedAccounts({ silent: true })

        const provider = createProviderForAccount(account)
        const connectedWallet: ConnectedEmbeddedSolanaWallet = {
          id: account.id,
          address: account.address,
          chainType: ChainTypeEnum.SVM,
          walletIndex: 0,
          recoveryMethod: account.recoveryMethod,
          getProvider: async () => provider,
        }

        setState({
          status: 'connected',
          activeWallet: connectedWallet,
          provider,
          error: null,
        })

        createOptions?.onSuccess?.({ account })
        return account
      } catch (err) {
        const error = asOpenfortError(err, (cause) => new WalletCreationError({ chain: 'Solana', cause }))

        setState((s) => ({
          ...s,
          status: 'error',
          error: error.message,
        }))

        createOptions?.onError?.(error)
        throw error
      }
    },
    [client, walletConfig, createProviderForAccount, updateEmbeddedAccounts, setActiveEmbeddedAddress]
  )

  const importWallet = useCallback(
    async (importOptions: ImportEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
      setState((s) => ({ ...s, status: 'creating', error: null }))

      try {
        if (!walletConfig) {
          throw new WalletConfigNotFoundError()
        }

        const recoveryParams = await buildRecoveryParams(
          {
            recoveryMethod: importOptions.recoveryMethod,
            passkeyId: importOptions.passkeyId,
            password: importOptions.password,
            otpCode: importOptions.otpCode,
          },
          {
            walletConfig,
            getAccessToken: () => client.getAccessToken(),
            getUserId: () => client.user.get().then((u) => u?.id),
          }
        )

        const account = await client.embeddedWallet.import({
          privateKey: importOptions.privateKey,
          chainType: ChainTypeEnum.SVM,
          accountType: AccountTypeEnum.EOA,
          recoveryParams,
        })

        setActiveEmbeddedAddress(account.address)
        await updateEmbeddedAccounts({ silent: true })

        const provider = createProviderForAccount(account)
        const connectedWallet: ConnectedEmbeddedSolanaWallet = {
          id: account.id,
          address: account.address,
          chainType: ChainTypeEnum.SVM,
          walletIndex: 0,
          recoveryMethod: account.recoveryMethod,
          getProvider: async () => provider,
        }

        setState({
          status: 'connected',
          activeWallet: connectedWallet,
          provider,
          error: null,
        })

        importOptions.onSuccess?.({ account })
        return account
      } catch (err) {
        const error = asOpenfortError(err, (cause) => new WalletImportError({ chain: 'Solana', cause }))

        setState((s) => ({
          ...s,
          status: 'error',
          error: error.message,
        }))

        importOptions.onError?.(error)
        throw error
      }
    },
    [client, walletConfig, createProviderForAccount, updateEmbeddedAccounts, setActiveEmbeddedAddress]
  )

  const setActive = useCallback(
    async (activeOptions: SetActiveSolanaWalletOptions): Promise<void> => {
      const run = async (): Promise<void> => {
        const accounts = solanaAccountsRef.current
        const account = accounts.find((acc) => acc.address === activeOptions.address)

        if (!account) {
          throw new WalletNotFoundError(`Embedded wallet ${activeOptions.address} not found.`)
        }

        const connectingStub: ConnectedEmbeddedSolanaWallet = {
          id: account.id,
          address: account.address,
          chainType: ChainTypeEnum.SVM,
          walletIndex: accounts.indexOf(account),
          recoveryMethod: account.recoveryMethod,
          getProvider: async () => {
            throw new ProviderNotReadyError()
          },
        }
        setState((s) => ({ ...s, status: 'connecting', activeWallet: connectingStub, error: null }))

        try {
          const config: BuildRecoveryParamsConfig = {
            walletConfig,
            getAccessToken: () => client.getAccessToken(),
            getUserId: () => client.user.get().then((u) => u?.id),
          }
          const resolved = await resolveRecoveryForSetActive(account, activeOptions, config)
          if (resolved.needsRecovery) {
            setState((s) => ({ ...s, status: 'needs-recovery', error: null }))
            return
          }

          const recoveryParams = resolved.recoveryParams
          if (recoveryParams) {
            await client.embeddedWallet.recover({
              account: account.id,
              recoveryParams,
            })
          }

          const provider = createProviderForAccount(account)
          const connectedWallet: ConnectedEmbeddedSolanaWallet = {
            id: account.id,
            address: account.address,
            chainType: ChainTypeEnum.SVM,
            walletIndex: accounts.indexOf(account),
            recoveryMethod: account.recoveryMethod,
            getProvider: async () => provider,
          }

          setState({
            status: 'connected',
            activeWallet: connectedWallet,
            provider,
            error: null,
          })
          setActiveEmbeddedAddress(account.address)
        } catch (err) {
          const error = asOpenfortError(err, (cause) => new SetActiveWalletError({ chain: 'Solana', cause }))

          setState((s) => ({
            ...s,
            status: 'error',
            error: error.message,
          }))

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
    [client, walletConfig, createProviderForAccount, setActiveEmbeddedAddress]
  )

  const setRecovery = useCallback(
    async (recoveryOptions: SetRecoveryOptions): Promise<void> => {
      try {
        await client.embeddedWallet.setRecoveryMethod(recoveryOptions.previousRecovery, recoveryOptions.newRecovery)
        await updateEmbeddedAccounts({ silent: true })
      } catch (err) {
        const error = asOpenfortError(err, (cause) => new RecoveryError('Failed to set recovery method.', { cause }))
        throw error
      }
    },
    [client, updateEmbeddedAccounts]
  )

  const exportPrivateKey = useCallback(async (): Promise<string> => {
    return await client.embeddedWallet.exportPrivateKey()
  }, [client])

  const actions = useMemo(
    () => ({
      create,
      import: importWallet,
      wallets,
      setActive,
      setRecovery,
      exportPrivateKey,
    }),
    [create, importWallet, wallets, setActive, setRecovery, exportPrivateKey]
  )

  // Clear local state when core clears activeEmbeddedAddress (e.g. logout).
  useEffect(() => {
    if (!activeEmbeddedAddress && (state.status === 'connected' || state.status === 'needs-recovery')) {
      setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
    }
  }, [activeEmbeddedAddress, state.status])

  // Sync local state from core's activeEmbeddedAddress (single source of truth).
  useEffect(() => {
    if (
      isLoadingAccounts ||
      solanaAccounts.length === 0 ||
      embeddedState !== EmbeddedState.READY ||
      state.status === 'connecting' ||
      state.status === 'reconnecting' ||
      state.status === 'creating'
      // NOTE: 'error' is intentionally NOT blocked here — mirrors EVM hook behaviour.
      // If setActive failed but embeddedState is READY, the sync can self-heal by
      // rebuilding the provider directly (no recover() call needed).
    ) {
      return
    }
    const accountByAddress = activeEmbeddedAddress
      ? solanaAccounts.find((acc) => acc.address === activeEmbeddedAddress)
      : undefined
    const currentMatches = state.status === 'connected' && state.activeWallet?.address === activeEmbeddedAddress

    if (!activeEmbeddedAddress && state.status === 'connected') {
      setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
      return
    }

    if (accountByAddress && !currentMatches) {
      const provider = createProviderForAccount(accountByAddress)
      const connectedWallet: ConnectedEmbeddedSolanaWallet = {
        id: accountByAddress.id,
        address: accountByAddress.address,
        chainType: ChainTypeEnum.SVM,
        walletIndex: solanaAccounts.indexOf(accountByAddress),
        recoveryMethod: accountByAddress.recoveryMethod,
        getProvider: async () => provider,
      }
      setState({
        status: 'connected',
        activeWallet: connectedWallet,
        provider,
        error: null,
      })
    }

    // activeEmbeddedAddress is from other chain (e.g. EVM); auto-activate first SVM wallet.
    // Only when on SVM view to prevent ping-pong with Ethereum hook.
    // Also runs from 'error' state: if setActive failed (e.g. recover() threw) but the
    // address still points to an EVM wallet, we need to re-point to the SVM wallet so
    // the sync effect above can self-heal via createProviderForAccount.
    const firstSolanaAccount = solanaAccounts[0]
    if (
      chainType === ChainTypeEnum.SVM &&
      !accountByAddress &&
      activeEmbeddedAddress &&
      firstSolanaAccount &&
      (state.status === 'disconnected' || state.status === 'error')
    ) {
      setActiveEmbeddedAddress(firstSolanaAccount.address)
    }
  }, [
    isLoadingAccounts,
    state.status,
    state.activeWallet?.address,
    solanaAccounts,
    embeddedState,
    activeEmbeddedAddress,
    chainType,
    createProviderForAccount,
    setActiveEmbeddedAddress,
  ])

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

  // Cluster: option override (parity with Ethereum chainId) or Solana context
  const solanaContext = useContext(SolanaContext)
  const cluster = (options?.cluster ?? solanaContext?.cluster) as SolanaCluster | undefined
  const rpcUrl =
    solanaContext && solanaContext.cluster === cluster
      ? solanaContext.rpcUrl
      : cluster
        ? getDefaultSolanaRpcUrl(cluster)
        : solanaContext?.rpcUrl

  const connectedStateProps = useMemo(
    () => toConnectedStateProperties(state.status, state.activeWallet),
    [state.status, state.activeWallet]
  )

  // Compute displayAddress when connected
  const displayAddress = useMemo(
    () =>
      state.activeWallet?.address && (state.status === 'connected' || state.status === 'connecting')
        ? formatAddress(state.activeWallet.address, ChainTypeEnum.SVM)
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
    } as SolanaWalletState
  }

  return {
    ...buildEmbeddedWalletStatusResult(state, actions),
    ...derived,
    ...connectedStateProps,
    ...(displayAddress && { displayAddress }),
    ...(state.activeWallet?.address && { address: state.activeWallet.address }),
    ...(cluster && { cluster }),
    ...(rpcUrl && { rpcUrl }),
  } as SolanaWalletState
}
