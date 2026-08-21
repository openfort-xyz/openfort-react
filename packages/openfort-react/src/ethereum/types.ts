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
import type { Hex } from 'viem'
import type {
  ConnectedWalletState,
  CreateEmbeddedWalletOptions,
  ImportEmbeddedWalletOptions,
  SetActiveEmbeddedWalletOptionsBase,
  SetRecoveryOptions as SharedSetRecoveryOptions,
  WalletDerived,
} from '../shared/types'

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

type EIP1193RequestArguments = {
  readonly method: string
  readonly params?: readonly unknown[] | object
}

type EIP1193EventName = 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect' | 'message'

type EIP1193EventHandler = (...args: unknown[]) => void

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

type EthereumWalletStateBase =
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
