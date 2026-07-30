'use client'

import { ChainTypeEnum, type EmbeddedAccount, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { baseSepolia } from 'viem/chains'
import { useOpenfortUIContext as useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { DEFAULT_ACCOUNT_TYPE } from '../../constants/openfort.js'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext.js'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import type {
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetRecoveryOptions,
  WalletStatus,
} from '../../shared/types.js'
import { buildEmbeddedWalletStatusResult } from '../../shared/utils/embeddedWalletStatusMapper.js'
import { buildRecoveryParams } from '../../shared/utils/recovery.js'
import { toConnectedStateProperties } from '../../shared/utils/walletStatusProps.js'
import { formatAddress } from '../../utils/format.js'
import type {
  ConnectedEmbeddedEthereumWallet,
  EthereumWalletState,
  OpenfortEmbeddedEthereumWalletProvider,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
} from '../types.js'

type InternalState = {
  status: WalletStatus
  activeWallet: ConnectedEmbeddedEthereumWallet | null
  provider: OpenfortEmbeddedEthereumWalletProvider | null
  error: string | null
}

/** Base Sepolia — fallback chain when no strategy or config provides a chain ID. */
const DEFAULT_TESTNET_CHAIN_ID = baseSepolia.id

function buildConnectedWallet(
  acc: EmbeddedAccount,
  index: number,
  getProvider: () => Promise<OpenfortEmbeddedEthereumWalletProvider>,
  overrides?: Partial<Pick<ConnectedEmbeddedEthereumWallet, 'isActive' | 'isConnecting' | 'getProvider'>>
): ConnectedEmbeddedEthereumWallet {
  return {
    id: acc.id,
    address: acc.address as `0x${string}`,
    ownerAddress: acc.ownerAddress,
    implementationType: acc.implementationType,
    chainType: ChainTypeEnum.EVM,
    walletIndex: index,
    recoveryMethod: acc.recoveryMethod,
    getProvider: overrides?.getProvider ?? getProvider,
    isAvailable: true,
    isActive: overrides?.isActive ?? false,
    isConnecting: overrides?.isConnecting ?? false,
    accounts: [{ id: acc.id, chainId: acc.chainId }],
    connectorType: 'embedded',
    walletClientType: 'openfort',
    accountId: acc.id,
    accountType: acc.accountType,
    createdAt: acc.createdAt,
    salt: acc.salt,
  }
}

/**
 * Returns state for EVM embedded wallets: create, recover, list, active wallet, and provider.
 * Use for creating accounts, recovering existing ones, and signing transactions.
 *
 * @param options - Optional chainId override for multi-chain
 * @returns State with status, wallets, activeWallet, create, recover, setActive, provider
 *
 * @example
 * ```tsx
 * const evm = useEthereumEmbeddedWallet()
 * if (evm.status === 'connected') {
 *   const sig = await evm.provider?.request({ method: 'personal_sign', params: [hash, address] })
 * }
 * ```
 */
export function useEthereumEmbeddedWallet(options?: UseEmbeddedEthereumWalletOptions): EthereumWalletState {
  const {
    client,
    embeddedAccounts,
    embeddedState,
    isLoadingAccounts,
    updateEmbeddedAccounts,
    setActiveEmbeddedAddress,
    setWalletStatus,
    activeEmbeddedAddress,
  } = useOpenfortCore()
  const { walletConfig, chainType } = useOpenfort()
  const strategy = useConnectionStrategy()

  const creationChainId = options?.chainId ?? strategy?.getChainId() ?? DEFAULT_TESTNET_CHAIN_ID
  const activeReturnChainId = strategy?.getChainId() ?? DEFAULT_TESTNET_CHAIN_ID

  const setActiveInProgressRef = useRef<Promise<void> | null>(null)
  const ethereumAccountsRef = useRef<EmbeddedAccount[]>([])

  const [state, setState] = useState<InternalState>({
    status: 'disconnected',
    activeWallet: null,
    provider: null,
    error: null,
  })

  const ethereumAccounts = useMemo(() => {
    if (!embeddedAccounts) return []
    return embeddedAccounts.filter((acc) => acc.chainType === ChainTypeEnum.EVM)
  }, [embeddedAccounts])
  ethereumAccountsRef.current = ethereumAccounts

  const getEmbeddedEthereumProvider = useCallback(async (): Promise<OpenfortEmbeddedEthereumWalletProvider> => {
    const provider = await client.embeddedWallet.getEthereumProvider()
    // Ensure the current account is authorized on the provider.
    // Without this, signing after password recovery can fail with
    // "Unauthorized - call eth_requestAccounts first" because the provider
    // was obtained before initProvider ran with proper config.
    await provider.request({ method: 'eth_requestAccounts' })
    return provider as OpenfortEmbeddedEthereumWalletProvider
  }, [client])

  const wallets = useMemo<ConnectedEmbeddedEthereumWallet[]>(() => {
    const uniqueAddresses = new Map<string, EmbeddedAccount>()
    for (const acc of ethereumAccounts) {
      const key = acc.address.toLowerCase()
      if (!uniqueAddresses.has(key)) {
        uniqueAddresses.set(key, acc)
      }
    }
    const activeAddr = state.activeWallet?.address.toLowerCase()
    const isConnecting = state.status === 'connecting' || state.status === 'reconnecting'

    return Array.from(uniqueAddresses.values()).map((acc, index) => {
      const addr = (acc.address as string).toLowerCase()
      return buildConnectedWallet(acc, index, getEmbeddedEthereumProvider, {
        isActive: state.status === 'connected' && activeAddr === addr,
        isConnecting: isConnecting && activeAddr === addr,
      })
    })
  }, [ethereumAccounts, getEmbeddedEthereumProvider, state.status, state.activeWallet])

  useEffect(() => {
    if (state.status === 'creating') {
      setWalletStatus({ status: 'creating' })
    } else if (state.status === 'connecting' && state.activeWallet) {
      setWalletStatus({ status: 'connecting', address: state.activeWallet.address })
    } else {
      setWalletStatus({ status: 'idle' })
    }
  }, [state.status, state.activeWallet, setWalletStatus])

  const create = useCallback(
    async (createOptions?: CreateEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
      setState((s) => ({ ...s, status: 'creating', error: null }))

      try {
        if (!walletConfig) {
          throw new OpenfortError('Wallet config not found', OpenfortReactErrorType.CONFIGURATION_ERROR)
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
            getUserId: async () => {
              const user = await client.user.get()
              return user?.id
            },
          }
        )

        // Determine account type (use createOptions, then walletConfig, else default to Smart Account)
        const accountType = createOptions?.accountType ?? walletConfig?.ethereum?.accountType ?? DEFAULT_ACCOUNT_TYPE

        const account = await client.embeddedWallet.create({
          chainType: ChainTypeEnum.EVM,
          accountType,
          ...(accountType !== DEFAULT_ACCOUNT_TYPE && { chainId: createOptions?.chainId ?? creationChainId }),
          recoveryParams,
        })

        // Set the address before fetching accounts or setting connected state.
        // This prevents a race where the sync effect sees status='connected' but
        // no activeEmbeddedAddress and disconnects (especially for the first wallet
        // when embeddedAccounts is still empty).
        setActiveEmbeddedAddress(account.address)
        await updateEmbeddedAccounts({ silent: true })

        const provider = await getEmbeddedEthereumProvider()
        const connectedWallet = buildConnectedWallet(account, 0, async () => provider, {
          isActive: true,
          isConnecting: false,
        })

        setState({
          status: 'connected',
          activeWallet: connectedWallet,
          provider,
          error: null,
        })

        createOptions?.onSuccess?.({ account })
        return account
      } catch (err) {
        const error =
          err instanceof OpenfortError
            ? err
            : new OpenfortError('Failed to create Ethereum wallet', OpenfortReactErrorType.WALLET_ERROR, { error: err })

        setState((s) => ({
          ...s,
          status: 'error',
          error: error.message,
        }))

        createOptions?.onError?.(error)
        throw error
      }
    },
    [
      client,
      walletConfig,
      creationChainId,
      getEmbeddedEthereumProvider,
      updateEmbeddedAccounts,
      setActiveEmbeddedAddress,
    ]
  )

  const importWallet = useCallback(
    async (importOptions: ImportEmbeddedWalletOptions): Promise<EmbeddedAccount> => {
      setState((s) => ({ ...s, status: 'creating', error: null }))

      try {
        if (!walletConfig) {
          throw new OpenfortError('Wallet config not found', OpenfortReactErrorType.CONFIGURATION_ERROR)
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
            getUserId: async () => {
              const user = await client.user.get()
              return user?.id
            },
          }
        )

        const accountType = importOptions.accountType ?? walletConfig?.ethereum?.accountType ?? DEFAULT_ACCOUNT_TYPE

        const account = await client.embeddedWallet.import({
          privateKey: importOptions.privateKey,
          chainType: ChainTypeEnum.EVM,
          accountType,
          ...(accountType !== DEFAULT_ACCOUNT_TYPE && { chainId: importOptions.chainId ?? creationChainId }),
          recoveryParams,
        })

        setActiveEmbeddedAddress(account.address)
        await updateEmbeddedAccounts({ silent: true })

        const provider = await getEmbeddedEthereumProvider()
        const connectedWallet = buildConnectedWallet(account, 0, async () => provider, {
          isActive: true,
          isConnecting: false,
        })

        setState({
          status: 'connected',
          activeWallet: connectedWallet,
          provider,
          error: null,
        })

        importOptions.onSuccess?.({ account })
        return account
      } catch (err) {
        const error =
          err instanceof OpenfortError
            ? err
            : new OpenfortError('Failed to import Ethereum wallet', OpenfortReactErrorType.WALLET_ERROR, { error: err })

        setState((s) => ({
          ...s,
          status: 'error',
          error: error.message,
        }))

        importOptions.onError?.(error)
        throw error
      }
    },
    [
      client,
      walletConfig,
      creationChainId,
      getEmbeddedEthereumProvider,
      updateEmbeddedAccounts,
      setActiveEmbeddedAddress,
    ]
  )

  const setActive = useCallback(
    async (activeOptions: SetActiveEthereumWalletOptions): Promise<void> => {
      const run = async (): Promise<void> => {
        const accounts = ethereumAccountsRef.current
        const account = accounts.find((acc) => acc.address.toLowerCase() === activeOptions.address.toLowerCase())

        if (!account) {
          throw new OpenfortError('Embedded wallet not found', OpenfortReactErrorType.WALLET_ERROR, {
            address: activeOptions.address,
          })
        }

        const connectingStub = buildConnectedWallet(account, accounts.indexOf(account), getEmbeddedEthereumProvider, {
          isActive: false,
          isConnecting: true,
          getProvider: async () => {
            throw new OpenfortError('Provider not ready yet', OpenfortReactErrorType.WALLET_ERROR)
          },
        })
        setState((s) => ({ ...s, status: 'connecting', activeWallet: connectingStub, error: null }))

        try {
          const password = activeOptions.password
          const hasExplicitRecovery =
            activeOptions.recoveryParams != null || password != null || activeOptions.recoveryMethod !== undefined

          let recoveryParams = activeOptions.recoveryParams
          if (!recoveryParams && !hasExplicitRecovery) {
            if (account.recoveryMethod === RecoveryMethod.PASSKEY) {
              const passkeyId = activeOptions.passkeyId ?? account.recoveryMethodDetails?.passkeyId
              recoveryParams = {
                recoveryMethod: RecoveryMethod.PASSKEY,
                ...(passkeyId && { passkeyInfo: { passkeyId } }),
              }
            } else if (account.recoveryMethod === RecoveryMethod.PASSWORD) {
              setState((s) => ({ ...s, status: 'needs-recovery', error: null }))
              return
            } else {
              recoveryParams = await buildRecoveryParams(
                { recoveryMethod: undefined, otpCode: activeOptions.otpCode },
                {
                  walletConfig,
                  getAccessToken: () => client.getAccessToken(),
                  getUserId: async () => (await client.user.get())?.id,
                }
              )
            }
          } else if (!recoveryParams && hasExplicitRecovery) {
            recoveryParams = await buildRecoveryParams(
              {
                recoveryMethod:
                  activeOptions.recoveryMethod ?? (password != null ? RecoveryMethod.PASSWORD : undefined),
                passkeyId: activeOptions.passkeyId ?? account.recoveryMethodDetails?.passkeyId,
                password,
                otpCode: activeOptions.otpCode,
              },
              {
                walletConfig,
                getAccessToken: () => client.getAccessToken(),
                getUserId: async () => (await client.user.get())?.id,
              }
            )
          }

          if (recoveryParams) {
            await client.embeddedWallet.recover({
              account: account.id,
              recoveryParams,
            })
          }

          const provider = await getEmbeddedEthereumProvider()
          const connectedWallet = buildConnectedWallet(account, accounts.indexOf(account), async () => provider, {
            isActive: true,
            isConnecting: false,
          })

          setState({
            status: 'connected',
            activeWallet: connectedWallet,
            provider,
            error: null,
          })
          setActiveEmbeddedAddress(account.address)
        } catch (err) {
          const error =
            err instanceof OpenfortError
              ? err
              : new OpenfortError('Failed to set active Ethereum wallet', OpenfortReactErrorType.WALLET_ERROR, {
                  error: err,
                })

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
    [client, walletConfig, getEmbeddedEthereumProvider, setActiveEmbeddedAddress]
  )

  const setRecovery = useCallback(
    async (recoveryOptions: SetRecoveryOptions): Promise<void> => {
      try {
        await client.embeddedWallet.setRecoveryMethod(recoveryOptions.previousRecovery, recoveryOptions.newRecovery)
        await updateEmbeddedAccounts({ silent: true })
      } catch (err) {
        const error =
          err instanceof OpenfortError
            ? err
            : new OpenfortError('Failed to set recovery method', OpenfortReactErrorType.WALLET_ERROR, { error: err })
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

  // Use refs for values that should NOT re-trigger the sync effect.
  const stateRef = useRef(state)
  stateRef.current = state

  // Prevents the sync effect from firing multiple async getProvider calls concurrently.
  const syncInProgressRef = useRef<string | null>(null)

  // Sync local state from core's activeEmbeddedAddress (single source of truth).
  // Only re-runs when the three meaningful inputs change: activeEmbeddedAddress, embeddedState, accounts list.
  useEffect(() => {
    const s = stateRef.current

    // Not ready to sync yet
    if (isLoadingAccounts || ethereumAccounts.length === 0 || embeddedState !== EmbeddedState.READY) {
      // Clear state if address was removed (logout) while we're in a connected state
      if (!activeEmbeddedAddress && (s.status === 'connected' || s.status === 'needs-recovery')) {
        setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
      }
      return undefined
    }

    // Don't interrupt in-progress operations
    if (s.status === 'connecting' || s.status === 'reconnecting' || s.status === 'creating') {
      return undefined
    }

    // Logout / address cleared
    if (!activeEmbeddedAddress && s.status === 'connected') {
      setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
      return undefined
    }

    // Find matching account
    const accountByAddress = activeEmbeddedAddress
      ? ethereumAccounts.find((acc) => acc.address.toLowerCase() === activeEmbeddedAddress.toLowerCase())
      : undefined

    // Already synced to the right address
    if (s.status === 'connected' && s.activeWallet?.address.toLowerCase() === activeEmbeddedAddress?.toLowerCase()) {
      return undefined
    }

    // Activate the matching account
    if (accountByAddress) {
      // Already syncing this address — skip duplicate async work
      if (syncInProgressRef.current === accountByAddress.address.toLowerCase()) {
        return undefined
      }

      syncInProgressRef.current = accountByAddress.address.toLowerCase()
      let cancelled = false
      getEmbeddedEthereumProvider()
        .then(async (provider) => {
          if (cancelled) return

          // The provider signs with the account in the core SDK's storage, which
          // can differ from `activeEmbeddedAddress` when the latter was seeded from
          // the accounts list (e.g. the first-account fallback in useActiveAddressSync
          // when the user has multiple smart accounts) rather than the SDK's active
          // wallet. Reconcile to the provider's real account so the displayed wallet
          // and the actual signer always agree — otherwise personal_sign rejects with
          // "personal_sign requires the signer to be the from address".
          const providerAccounts = (await provider.request({ method: 'eth_accounts' }).catch(() => [])) as string[]
          const realAddr = providerAccounts?.[0]?.toLowerCase()
          const resolved =
            (realAddr && ethereumAccounts.find((acc) => acc.address.toLowerCase() === realAddr)) || accountByAddress
          if (cancelled) return

          const connectedWallet = buildConnectedWallet(
            resolved,
            ethereumAccounts.indexOf(resolved),
            async () => provider,
            { isActive: true, isConnecting: false }
          )
          setState({ status: 'connected', activeWallet: connectedWallet, provider, error: null })

          // Keep the single source of truth in step. The deps-driven re-run then hits
          // the "already synced" guard above and stops — no render loop.
          if (resolved.address.toLowerCase() !== activeEmbeddedAddress?.toLowerCase()) {
            setActiveEmbeddedAddress(resolved.address)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) syncInProgressRef.current = null
        })
      return () => {
        cancelled = true
        syncInProgressRef.current = null
      }
    }

    // activeEmbeddedAddress is from another chain (e.g. SVM); auto-activate first EVM wallet.
    // Also fires from 'error': if setActive failed and address still points to a SVM wallet,
    // re-point to the EVM wallet so the sync can self-heal.
    const firstEvmAccount = ethereumAccounts[0]
    if (
      chainType === ChainTypeEnum.EVM &&
      activeEmbeddedAddress &&
      firstEvmAccount &&
      (s.status === 'disconnected' || s.status === 'error')
    ) {
      setActiveEmbeddedAddress(firstEvmAccount.address)
    }
    return undefined
  }, [
    activeEmbeddedAddress,
    embeddedState,
    ethereumAccounts,
    isLoadingAccounts,
    chainType,
    getEmbeddedEthereumProvider,
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

  const connectedStateProps = useMemo(
    () => toConnectedStateProperties(state.status, state.activeWallet),
    [state.status, state.activeWallet]
  )

  // Compute displayAddress when connected
  const displayAddress = useMemo(
    () =>
      state.activeWallet?.address && (state.status === 'connected' || state.status === 'connecting')
        ? formatAddress(state.activeWallet.address, ChainTypeEnum.EVM)
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
    } as EthereumWalletState
  }

  return {
    ...buildEmbeddedWalletStatusResult(state, actions),
    ...derived,
    ...connectedStateProps,
    ...(displayAddress && { displayAddress }),
    ...(state.activeWallet?.address && { address: state.activeWallet.address }),
    chainId: activeReturnChainId,
  } as EthereumWalletState
}
