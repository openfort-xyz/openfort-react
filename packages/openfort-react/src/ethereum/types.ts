/**
 * Ethereum-specific types for @openfort/react/ethereum
 *
 * These types define the Ethereum wallet state machine and related interfaces.
 */

import type {
  AccountTypeEnum,
  ChainTypeEnum,
  EmbeddedAccount,
  RecoveryMethod,
  RecoveryParams,
} from '@openfort/openfort-js'
import type { Abi, Hex } from 'viem'
import type { OpenfortError } from '../core/errors'
import type {
  ConnectedWalletState,
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetActiveEmbeddedWalletOptionsBase,
  SetRecoveryOptions as SharedSetRecoveryOptions,
  WalletDerived,
} from '../shared/types'
import type { OpenfortHookOptions } from '../types'

export type FeeSponsorshipConfig = string | Record<number, string>

export type EthereumConfig = {
  /** Initial chain ID for the embedded wallet provider.
   * Optional when using OpenfortWagmiBridge — chain is managed by wagmi.
   * Required for SDK-only (no wagmi) mode; defaults to Sepolia if omitted. */
  chainId?: number
  rpcUrls?: Record<number, string>
  /** Fee sponsorship ID for gas sponsorship / embedded signer */
  ethereumFeeSponsorshipId?: FeeSponsorshipConfig
  accountType?: AccountTypeEnum
  /** Token addresses for asset inventory (chainId -> Hex[]) */
  assets?: Record<number, Hex[]>
}

/**
 * EIP-1193 Provider interface for Ethereum wallets
 */
export interface OpenfortEmbeddedEthereumWalletProvider {
  request(args: EIP1193RequestArguments): Promise<unknown>
  on(event: EIP1193EventName | string, handler: EIP1193EventHandler): void
  removeListener(event: EIP1193EventName | string, handler: EIP1193EventHandler): void
}

export type EIP1193RequestArguments = {
  readonly method: string
  readonly params?: readonly unknown[] | object
}

export type EIP1193EventName = 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect' | 'message'

export type EIP1193EventHandler = (...args: unknown[]) => void

type SimpleAccount = {
  id: string
  chainId?: number
}

export type ConnectedEmbeddedEthereumWallet = {
  id: string
  address: `0x${string}`
  ownerAddress?: string
  implementationType?: string
  chainType: typeof ChainTypeEnum.EVM
  walletIndex: number
  recoveryMethod?: RecoveryMethod
  getProvider(): Promise<OpenfortEmbeddedEthereumWalletProvider>
  isAvailable: boolean
  isActive: boolean
  isConnecting: boolean
  accounts: SimpleAccount[]
  connectorType?: string
  walletClientType?: string
  accountId?: string
  accountType?: AccountTypeEnum
  createdAt?: number
  salt?: string
}

/** Options for setting active Ethereum wallet (chain-specific address + shared recovery). */
export type SetActiveEthereumWalletOptions = SetActiveEmbeddedWalletOptionsBase & {
  /** Wallet address to set as active */
  address: `0x${string}`
  /** Chain ID (required for Smart Accounts) */
  chainId?: number
}

/**
 * Actions available on Ethereum embedded wallets
 */
export interface EthereumWalletActions {
  /** Create a new Ethereum embedded wallet */
  create(options?: CreateEmbeddedWalletOptions): Promise<EmbeddedAccount>
  /** Import an Ethereum embedded wallet from a hex-encoded private key */
  import(options: ImportEmbeddedWalletOptions): Promise<EmbeddedAccount>
  /** List of available Ethereum wallets */
  wallets: ConnectedEmbeddedEthereumWallet[]
  /** Set the active wallet */
  setActive(options: SetActiveEthereumWalletOptions): Promise<void>
  /** Update recovery method */
  setRecovery(options: SharedSetRecoveryOptions): Promise<void>
  /** Export the private key (requires user confirmation) */
  exportPrivateKey(): Promise<string>
}

export type EthereumWalletStateBase =
  | (EthereumWalletActions & {
      status: 'disconnected'
      activeWallet: null
      address?: never
      chainId?: never
      displayAddress?: never
    })
  | (EthereumWalletActions & {
      status: 'fetching-wallets'
      activeWallet: null
      address?: never
      chainId?: never
      displayAddress?: never
    })
  | (EthereumWalletActions & {
      status: 'connecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
      address: `0x${string}`
      chainId?: number
      displayAddress: string
    })
  | (EthereumWalletActions & {
      status: 'reconnecting'
      activeWallet: ConnectedEmbeddedEthereumWallet
      address: `0x${string}`
      chainId?: number
      displayAddress: string
    })
  | (EthereumWalletActions & {
      status: 'creating'
      activeWallet: null
      address?: never
      chainId?: never
      displayAddress?: never
    })
  | (EthereumWalletActions & {
      status: 'needs-recovery'
      activeWallet: ConnectedEmbeddedEthereumWallet
      address?: `0x${string}`
      chainId?: number
      displayAddress?: string
    })
  | (EthereumWalletActions & {
      status: 'connected'
      activeWallet: ConnectedEmbeddedEthereumWallet
      provider: OpenfortEmbeddedEthereumWalletProvider
      address: `0x${string}`
      chainId: number
      displayAddress: string
    })
  | (EthereumWalletActions & {
      status: 'error'
      activeWallet: ConnectedEmbeddedEthereumWallet | null
      error: string
      address?: `0x${string}`
      chainId?: number
      displayAddress?: string
    })

export type EthereumWalletState = EthereumWalletStateBase & WalletDerived & ConnectedWalletState

export type UseEmbeddedEthereumWalletOptions = {
  /** Chain ID for smart account operations */
  chainId?: number
  /** Recovery params for wallet access */
  recoveryParams?: RecoveryParams
}

// ── Transactions (no wagmi required) ─────────────────────────────────────────

/** Parameters for a native EVM transaction. */
export type SendTransactionParams = {
  to: `0x${string}`
  /** Amount in wei. */
  value?: bigint
  /** Pre-encoded calldata. */
  data?: `0x${string}`
  /** Override the active chain for this transaction. */
  chainId?: number
}

/** Parameters for an EVM contract write (encoded with viem). */
export type WriteContractParams = {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  /** Amount in wei to send with the call. */
  value?: bigint
  /** Override the active chain for this transaction. */
  chainId?: number
}

export type UseSendTransactionOptions = OpenfortHookOptions<{ hash: `0x${string}` }>

type EvmSendStateFields = {
  /** The transaction hash once sent. */
  data: `0x${string}` | undefined
  status: 'idle' | 'loading' | 'success' | 'error'
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: OpenfortError | undefined
  /** True when a fee-sponsorship policy resolves for the active chain (gas is sponsored). */
  isSponsored: boolean
  reset: () => void
}

export type SendTransactionResult = EvmSendStateFields & {
  /** Send a transaction; resolves to the hash, or `undefined` on error (error surfaces via state/onError). */
  sendTransaction: (params: SendTransactionParams) => Promise<`0x${string}` | undefined>
  /** Send a transaction; resolves to the hash or throws on error. */
  sendTransactionAsync: (params: SendTransactionParams) => Promise<`0x${string}`>
}

export type UseWriteContractResult = EvmSendStateFields & {
  /** Write to a contract; resolves to the hash, or `undefined` on error. */
  writeContract: (params: WriteContractParams) => Promise<`0x${string}` | undefined>
  /** Write to a contract; resolves to the hash or throws on error. */
  writeContractAsync: (params: WriteContractParams) => Promise<`0x${string}`>
}

export type UseEthereumBalanceOptions = {
  /** Address to read (defaults to the active embedded EVM wallet). */
  address?: `0x${string}`
  /** Chain to read on (defaults to the active chain). */
  chainId?: number
  /** Enable/disable the query (defaults to enabled when an address is available). */
  enabled?: boolean
  /** Refetch interval in ms. */
  refetchInterval?: number
}

export type UseEthereumBalanceResult = {
  /** Native balance once loaded. */
  data: { value: bigint; formatted: string; symbol: string; decimals: number } | undefined
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: OpenfortError | undefined
  refetch: () => void
}
