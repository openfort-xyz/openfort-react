'use client'

import {
  AccountTypeEnum,
  ChainTypeEnum,
  type EmbeddedAccount,
  EmbeddedState,
  type Openfort,
} from '@openfort/openfort-js'
import { useCallback, useContext, useEffect } from 'react'
import type { EmbeddedAccountRequest } from '../../actions/createEmbeddedWallet.js'
import { ProviderNotReadyError } from '../../errors/wallet.js'
import type { WalletFlowStatus } from '../../hooks/openfort/walletTypes.js'
import type {
  EmbeddedWalletChainBindings,
  EmbeddedWalletSyncParameters,
} from '../../shared/hooks/createEmbeddedWalletHook.js'
import { createEmbeddedWalletHook } from '../../shared/hooks/createEmbeddedWalletHook.js'
import { getDefaultSolanaRpcUrl } from '../../utils/rpc.js'
import { getTransactionBytes } from '../operations.js'
import { createSolanaProvider } from '../provider.js'
import { SolanaContext } from '../SolanaContext.js'
import type {
  ConnectedEmbeddedSolanaWallet,
  OpenfortEmbeddedSolanaWalletProvider,
  SignedSolanaTransaction,
  SolanaCluster,
  SolanaTransaction,
  SolanaWalletState,
  UseEmbeddedSolanaWalletOptions,
} from '../types.js'

type SolanaSyncParameters = EmbeddedWalletSyncParameters<
  ConnectedEmbeddedSolanaWallet,
  OpenfortEmbeddedSolanaWalletProvider
>

/** Solana accounts sign Ed25519, so messages go to the signer unhashed. */
const SIGN_RAW = { hashMessage: false } as const

function createSolanaProviderForAccount(
  client: Openfort,
  account: EmbeddedAccount
): OpenfortEmbeddedSolanaWalletProvider {
  const signBytes = async (transaction: SolanaTransaction): Promise<SignedSolanaTransaction> => {
    const messageBytes = getTransactionBytes(transaction)
    const signature = await client.embeddedWallet.signMessage(new Uint8Array(messageBytes), SIGN_RAW)
    return { signature: signature as string, publicKey: account.address }
  }

  return createSolanaProvider({
    account,
    signMessage: async (message: string): Promise<string> => {
      const signature = await client.embeddedWallet.signMessage(message, SIGN_RAW)
      return signature as string
    },
    signTransaction: signBytes,
    signAllTransactions: (transactions: SolanaTransaction[]): Promise<SignedSolanaTransaction[]> =>
      Promise.all(transactions.map(signBytes)),
  })
}

function buildSolanaWallet(
  account: EmbeddedAccount,
  walletIndex: number,
  getProvider: () => Promise<OpenfortEmbeddedSolanaWalletProvider>
): ConnectedEmbeddedSolanaWallet {
  return {
    id: account.id,
    address: account.address,
    chainType: ChainTypeEnum.SVM,
    walletIndex,
    recoveryMethod: account.recoveryMethod,
    getProvider,
  }
}

/** The wallet exposed while `setActive` recovers has no usable provider yet. */
async function rejectUnreadyProvider(): Promise<never> {
  throw new ProviderNotReadyError()
}

function buildSolanaConnectingStatus(): WalletFlowStatus {
  return { status: 'connecting' }
}

function useSolanaChainBindings(options?: UseEmbeddedSolanaWalletOptions): EmbeddedWalletChainBindings {
  // Cluster: option override (parity with Ethereum chainId) or Solana context
  const solanaContext = useContext(SolanaContext)
  const cluster = (options?.cluster ?? solanaContext?.cluster) as SolanaCluster | undefined
  const rpcUrl =
    solanaContext && solanaContext.cluster === cluster
      ? solanaContext.rpcUrl
      : cluster
        ? getDefaultSolanaRpcUrl(cluster)
        : solanaContext?.rpcUrl

  // Solana embedded accounts are always EOAs and carry no chain ID.
  const buildAccountRequest = useCallback((): EmbeddedAccountRequest => ({ accountType: AccountTypeEnum.EOA }), [])

  return {
    buildAccountRequest,
    resultProps: { ...(cluster && { cluster }), ...(rpcUrl && { rpcUrl }) },
  }
}

function useSyncSolanaWallet(parameters: SolanaSyncParameters): void {
  const {
    client,
    accounts,
    activeEmbeddedAddress,
    embeddedState,
    isLoadingAccounts,
    routedChainType,
    state,
    setState,
    setActiveEmbeddedAddress,
  } = parameters

  // Clear local state when core clears activeEmbeddedAddress (e.g. logout).
  useEffect(() => {
    if (!activeEmbeddedAddress && (state.status === 'connected' || state.status === 'needs-recovery')) {
      setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
    }
  }, [activeEmbeddedAddress, state.status, setState])

  // Sync local state from core's activeEmbeddedAddress (single source of truth).
  useEffect(() => {
    if (
      isLoadingAccounts ||
      accounts.length === 0 ||
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
      ? accounts.find((acc) => acc.address === activeEmbeddedAddress)
      : undefined
    const currentMatches = state.status === 'connected' && state.activeWallet?.address === activeEmbeddedAddress

    if (!activeEmbeddedAddress && state.status === 'connected') {
      setState({ status: 'disconnected', activeWallet: null, provider: null, error: null })
      return
    }

    if (accountByAddress && !currentMatches) {
      const provider = createSolanaProviderForAccount(client, accountByAddress)
      const connectedWallet = buildSolanaWallet(
        accountByAddress,
        accounts.indexOf(accountByAddress),
        async () => provider
      )
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
    // the sync effect above can self-heal by rebuilding the provider.
    const firstSolanaAccount = accounts[0]
    if (
      routedChainType === ChainTypeEnum.SVM &&
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
    accounts,
    embeddedState,
    activeEmbeddedAddress,
    routedChainType,
    client,
    setActiveEmbeddedAddress,
    setState,
  ])
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
export const useSolanaEmbeddedWallet = createEmbeddedWalletHook<
  ConnectedEmbeddedSolanaWallet,
  OpenfortEmbeddedSolanaWalletProvider,
  UseEmbeddedSolanaWalletOptions,
  SolanaWalletState
>({
  chainType: ChainTypeEnum.SVM,
  chainName: 'Solana',
  normalizeAddress: (address) => address,
  buildProvider: async ({ client, account }) => createSolanaProviderForAccount(client, account),
  buildWallets: ({ accounts, getProvider }) =>
    accounts.map((acc, index) => buildSolanaWallet(acc, index, () => getProvider(acc))),
  buildActiveWallet: ({ account, walletIndex, provider }) =>
    buildSolanaWallet(account, walletIndex, async () => provider),
  buildConnectingWallet: ({ account, walletIndex }) => buildSolanaWallet(account, walletIndex, rejectUnreadyProvider),
  buildConnectingStatus: buildSolanaConnectingStatus,
  useChainBindings: useSolanaChainBindings,
  useSyncActiveWallet: useSyncSolanaWallet,
})
