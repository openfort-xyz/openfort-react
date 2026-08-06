import type { AccountTypeEnum, EmbeddedAccount, RecoveryMethod, RecoveryParams } from '@openfort/openfort-js'
import type { OpenfortError } from '../errors/base.js'
import type { OpenfortHookOptions } from '../types.js'

export type RecoverableWallet = {
  address: string
  id: string
  recoveryMethod?: RecoveryMethod
  accounts: { id: string }[]
}

type ActionFailure = {
  error: OpenfortError
}

export type SetRecoverySuccess = {
  error?: never
}

export type SetRecoveryResult = SetRecoverySuccess | ActionFailure

export type SetRecoveryOptions = {
  previousRecovery: RecoveryParams
  newRecovery: RecoveryParams
} & OpenfortHookOptions<SetRecoverySuccess>

export type WalletStatus =
  | 'disconnected'
  | 'fetching-wallets'
  | 'connecting'
  | 'reconnecting'
  | 'creating'
  | 'needs-recovery'
  | 'connected'
  | 'error'

/** Shared connected wallet state (EVM and Solana embedded hooks). */
export type ConnectedWalletState = {
  /** embeddedWalletId when connected (embedded-only hooks). */
  embeddedWalletId?: string
  isConnected: boolean
  isConnecting: boolean
  isDisconnected: boolean
  isReconnecting: boolean
}

/** Derived booleans for consistent hook shape (EVM and Solana). */
export type WalletDerived = {
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

/** Result of creating an embedded wallet (EVM or Solana). */
export type CreateEmbeddedWalletSuccess = {
  account: EmbeddedAccount
  error?: never
}

export type CreateEmbeddedWalletResult = CreateEmbeddedWalletSuccess | (ActionFailure & { account?: never })

export type SetActiveEmbeddedWalletSuccess = {
  needsRecovery: boolean
  error?: never
}

export type SetActiveEmbeddedWalletResult = SetActiveEmbeddedWalletSuccess | (ActionFailure & { needsRecovery?: never })

export type ExportPrivateKeySuccess = {
  privateKey: string
  error?: never
}

export type ExportPrivateKeyResult = ExportPrivateKeySuccess | (ActionFailure & { privateKey?: never })

export type ExportPrivateKeyOptions = OpenfortHookOptions<ExportPrivateKeySuccess>

/** Common options for setting active embedded wallet (recovery only; each chain adds address). */
export type SetActiveEmbeddedWalletOptionsBase = {
  /** Recovery params for wallet access (escape hatch; prefer named options) */
  recoveryParams?: RecoveryParams
  /** Recovery method when recoveryParams not provided */
  recoveryMethod?: RecoveryMethod
  /** Passkey ID for PASSKEY recovery */
  passkeyId?: string
  /** Password for PASSWORD recovery */
  password?: string
  /** OTP code for AUTOMATIC recovery */
  otpCode?: string
} & OpenfortHookOptions<SetActiveEmbeddedWalletSuccess>

/** Options for creating an embedded wallet (EVM and Solana; EOA and gas sponsorship). */
export type CreateEmbeddedWalletOptions = {
  /** Target chain ID for deployment (EVM) */
  chainId?: number
  /** Recovery method for key encryption */
  recoveryMethod?: RecoveryMethod
  /** Passkey ID for PASSKEY recovery */
  passkeyId?: string
  /** Password for PASSWORD recovery */
  password?: string
  /** OTP code for verification */
  otpCode?: string
  /** Account type (EOA, Smart Account, or Delegated Account) */
  accountType?: AccountTypeEnum
  /** Fee sponsorship ID for gas sponsorship */
  feeSponsorshipId?: string
} & OpenfortHookOptions<CreateEmbeddedWalletSuccess>

/**
 * Options for importing an embedded wallet from a raw private key.
 * EVM expects a hex-encoded private key; Solana expects a base58-encoded secret key.
 */
export type ImportEmbeddedWalletOptions = CreateEmbeddedWalletOptions & {
  /** Raw private key (hex for EVM, base58 for Solana). */
  privateKey: string
}
