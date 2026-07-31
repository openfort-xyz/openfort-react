'use client'

import { ChainTypeEnum, type EmbeddedAccount, EmbeddedState, type Openfort } from '@openfort/openfort-js'
import { useCallback, useEffect, useRef } from 'react'
import { baseSepolia } from 'viem/chains'
import type { EmbeddedAccountRequest } from '../../actions/createEmbeddedWallet.js'
import { useOpenfortConfig } from '../../components/Openfort/useOpenfort.js'
import { DEFAULT_ACCOUNT_TYPE } from '../../constants/openfort.js'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext.js'
import { ProviderNotReadyError } from '../../errors/wallet.js'
import type { WalletFlowStatus } from '../../hooks/openfort/walletTypes.js'
import type {
  EmbeddedWalletChainBindings,
  EmbeddedWalletSyncParameters,
} from '../../shared/hooks/createEmbeddedWalletHook.js'
import { createEmbeddedWalletHook } from '../../shared/hooks/createEmbeddedWalletHook.js'
import type { CreateEmbeddedWalletOptions, WalletStatus } from '../../shared/types.js'
import { logger } from '../../utils/logger.js'
import type {
  ConnectedEmbeddedEthereumWallet,
  EthereumWalletState,
  OpenfortEmbeddedEthereumWalletProvider,
  UseEmbeddedEthereumWalletOptions,
} from '../types.js'

/** Base Sepolia — fallback chain when no strategy or config provides a chain ID. */
const DEFAULT_TESTNET_CHAIN_ID = baseSepolia.id

type EthereumSyncParameters = EmbeddedWalletSyncParameters<
  ConnectedEmbeddedEthereumWallet,
  OpenfortEmbeddedEthereumWalletProvider
>

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

async function buildEthereumProvider({
  client,
  walletConfig,
}: {
  client: Openfort
  walletConfig: ReturnType<typeof useOpenfortConfig>['walletConfig']
}): Promise<OpenfortEmbeddedEthereumWalletProvider> {
  // Provider construction can race the strategy initialization during wallet
  // creation. Pass configured RPCs here because openfort-js memoizes the first
  // provider it creates for the session.
  const provider = await client.embeddedWallet.getEthereumProvider({
    chains: walletConfig?.ethereum?.rpcUrls,
  })
  // Ensure the current account is authorized on the provider.
  // Without this, signing after password recovery can fail with
  // "Unauthorized - call eth_requestAccounts first" because the provider
  // was obtained before initProvider ran with proper config.
  await provider.request({ method: 'eth_requestAccounts' })
  return provider as OpenfortEmbeddedEthereumWalletProvider
}

function buildEthereumWallets({
  accounts,
  getProvider,
  status,
  activeWallet,
}: {
  accounts: EmbeddedAccount[]
  getProvider: (account: EmbeddedAccount) => Promise<OpenfortEmbeddedEthereumWalletProvider>
  status: WalletStatus
  activeWallet: ConnectedEmbeddedEthereumWallet | null
}): ConnectedEmbeddedEthereumWallet[] {
  const uniqueAddresses = new Map<string, EmbeddedAccount>()
  for (const acc of accounts) {
    const key = acc.address.toLowerCase()
    if (!uniqueAddresses.has(key)) {
      uniqueAddresses.set(key, acc)
    }
  }
  const activeAddr = activeWallet?.address.toLowerCase()
  const isConnecting = status === 'connecting' || status === 'reconnecting'

  return Array.from(uniqueAddresses.values()).map((acc, index) => {
    const addr = (acc.address as string).toLowerCase()
    return buildConnectedWallet(acc, index, () => getProvider(acc), {
      isActive: status === 'connected' && activeAddr === addr,
      isConnecting: isConnecting && activeAddr === addr,
    })
  })
}

function buildEthereumConnectingStatus(wallet: ConnectedEmbeddedEthereumWallet): WalletFlowStatus {
  return { status: 'connecting', address: wallet.address }
}

/** The wallet exposed while `setActive` recovers has no usable provider yet. */
async function rejectUnreadyProvider(): Promise<never> {
  throw new ProviderNotReadyError()
}

function useEthereumChainBindings(options?: UseEmbeddedEthereumWalletOptions): EmbeddedWalletChainBindings {
  const { walletConfig } = useOpenfortConfig()
  const strategy = useConnectionStrategy()

  const creationChainId = options?.chainId ?? strategy?.getChainId() ?? DEFAULT_TESTNET_CHAIN_ID
  const activeReturnChainId = strategy?.getChainId() ?? DEFAULT_TESTNET_CHAIN_ID
  const configuredAccountType = walletConfig?.ethereum?.accountType

  // Account type comes from the call, then the wallet config, else Smart Account.
  // Only chain-bound account types carry a chainId.
  const buildAccountRequest = useCallback(
    (createOptions: CreateEmbeddedWalletOptions | undefined): EmbeddedAccountRequest => {
      const accountType = createOptions?.accountType ?? configuredAccountType ?? DEFAULT_ACCOUNT_TYPE
      return {
        accountType,
        ...(accountType !== DEFAULT_ACCOUNT_TYPE && { chainId: createOptions?.chainId ?? creationChainId }),
      }
    },
    [configuredAccountType, creationChainId]
  )

  return { buildAccountRequest, resultProps: { chainId: activeReturnChainId } }
}

function useSyncEthereumWallet(parameters: EthereumSyncParameters): void {
  const {
    accounts,
    activeEmbeddedAddress,
    embeddedState,
    isLoadingAccounts,
    routedChainType,
    state,
    setState,
    getProvider,
    setActiveEmbeddedAddress,
  } = parameters

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
    if (isLoadingAccounts || accounts.length === 0 || embeddedState !== EmbeddedState.READY) {
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
      ? accounts.find((acc) => acc.address.toLowerCase() === activeEmbeddedAddress.toLowerCase())
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
      getProvider(accountByAddress)
        .then(async (provider) => {
          if (cancelled) return

          // The provider signs with the account in the core SDK's storage, which
          // can differ from `activeEmbeddedAddress` when the latter was seeded from
          // the accounts list (e.g. the first-account fallback in useActiveAddressSync
          // when the user has multiple smart accounts) rather than the SDK's active
          // wallet. Reconcile to the provider's real account so the displayed wallet
          // and the actual signer always agree — otherwise personal_sign rejects with
          // "personal_sign requires the signer to be the from address".
          const providerAccounts = (await provider.request({ method: 'eth_accounts' }).catch(() => {
            // Some EIP-1193 providers do not expose eth_accounts until after a request.
            // The account selected by the SDK remains a safe fallback in that case.
            return []
          })) as string[]
          const realAddr = providerAccounts?.[0]?.toLowerCase()
          const resolved =
            (realAddr && accounts.find((acc) => acc.address.toLowerCase() === realAddr)) || accountByAddress
          if (cancelled) return

          const connectedWallet = buildConnectedWallet(resolved, accounts.indexOf(resolved), async () => provider, {
            isActive: true,
            isConnecting: false,
          })
          setState({ status: 'connected', activeWallet: connectedWallet, provider, error: null })

          // Keep the single source of truth in step. The deps-driven re-run then hits
          // the "already synced" guard above and stops — no render loop.
          if (resolved.address.toLowerCase() !== activeEmbeddedAddress?.toLowerCase()) {
            setActiveEmbeddedAddress(resolved.address)
          }
        })
        .catch((error) => {
          if (cancelled) return
          const syncError = error instanceof Error ? error : new Error('Failed to synchronize the embedded wallet.')
          logger.error('[EthereumEmbeddedWallet] Failed to synchronize the active wallet', syncError)
        })
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
    const firstEvmAccount = accounts[0]
    if (
      routedChainType === ChainTypeEnum.EVM &&
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
    accounts,
    isLoadingAccounts,
    routedChainType,
    getProvider,
    setActiveEmbeddedAddress,
    setState,
  ])
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
export const useEthereumEmbeddedWallet = createEmbeddedWalletHook<
  ConnectedEmbeddedEthereumWallet,
  OpenfortEmbeddedEthereumWalletProvider,
  UseEmbeddedEthereumWalletOptions,
  EthereumWalletState
>({
  chainType: ChainTypeEnum.EVM,
  chainName: 'Ethereum',
  normalizeAddress: (address) => address.toLowerCase(),
  buildProvider: buildEthereumProvider,
  buildWallets: buildEthereumWallets,
  buildActiveWallet: ({ account, walletIndex, provider }) =>
    buildConnectedWallet(account, walletIndex, async () => provider, { isActive: true, isConnecting: false }),
  buildConnectingWallet: ({ account, walletIndex }) =>
    buildConnectedWallet(account, walletIndex, rejectUnreadyProvider, {
      isActive: false,
      isConnecting: true,
      getProvider: rejectUnreadyProvider,
    }),
  buildConnectingStatus: buildEthereumConnectingStatus,
  useChainBindings: useEthereumChainBindings,
  useSyncActiveWallet: useSyncEthereumWallet,
})
