import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type WalletErrorOptions = Omit<OpenfortErrorOptions, 'type'>

/** The chain family a wallet error happened on, used to build its message. */
export type WalletChain = 'Ethereum' | 'Solana'

export type WalletErrorType = WalletError & { name: 'WalletError' }

/** An embedded or external wallet operation failed. */
export class WalletError extends OpenfortError {
  override name = 'WalletError'

  constructor(shortMessage: string, options: WalletErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.WALLET_ERROR })
  }
}

export type WalletCreationErrorType = WalletCreationError & { name: 'WalletCreationError' }

/** Creating an embedded wallet failed. */
export class WalletCreationError extends WalletError {
  override name = 'WalletCreationError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to create ${chain} wallet.`, options)
  }
}

export type WalletImportErrorType = WalletImportError & { name: 'WalletImportError' }

/** Importing an existing key into an embedded wallet failed. */
export class WalletImportError extends WalletError {
  override name = 'WalletImportError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to import ${chain} wallet.`, options)
  }
}

export type SetActiveWalletErrorType = SetActiveWalletError & { name: 'SetActiveWalletError' }

/** Switching the active embedded wallet failed. */
export class SetActiveWalletError extends WalletError {
  override name = 'SetActiveWalletError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to set active ${chain} wallet.`, options)
  }
}

export type WalletNotFoundErrorType = WalletNotFoundError & { name: 'WalletNotFoundError' }

/** No wallet is available for the requested operation. */
export class WalletNotFoundError extends WalletError {
  override name = 'WalletNotFoundError'

  constructor(shortMessage = 'Wallet not found.', options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

export type WalletNotConnectedErrorType = WalletNotConnectedError & { name: 'WalletNotConnectedError' }

/** A wallet exists but is not connected, so it cannot sign or read accounts. */
export class WalletNotConnectedError extends WalletError {
  override name = 'WalletNotConnectedError'

  constructor(shortMessage = 'Wallet not connected.', options: WalletErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['Connect a wallet before calling this action.'],
      ...options,
    })
  }
}

export type ProviderNotReadyErrorType = ProviderNotReadyError & { name: 'ProviderNotReadyError' }

/** The embedded wallet provider has not finished booting. */
export class ProviderNotReadyError extends WalletError {
  override name = 'ProviderNotReadyError'

  constructor(shortMessage = 'Provider not ready yet.', options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

export type RecoveryErrorType = RecoveryError & { name: 'RecoveryError' }

/** Configuring or running embedded wallet recovery failed. */
export class RecoveryError extends WalletError {
  override name = 'RecoveryError'

  constructor(shortMessage: string, options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

export type OtpRequiredErrorType = OtpRequiredError & { name: 'OtpRequiredError' }

/**
 * Recovery cannot proceed until the user supplies a one-time code.
 *
 * `canRequestOtp` reflects whether the app configured a way to send that code;
 * when it did not, the message says which option to set.
 */
export class OtpRequiredError extends RecoveryError {
  override name = 'OtpRequiredError'

  constructor({ canRequestOtp, ...options }: WalletErrorOptions & { canRequestOtp: boolean }) {
    super('OTP code is required to recover the wallet.', {
      ...(canRequestOtp
        ? {}
        : {
            metaMessages: [
              'Set `requestWalletRecoveryOTP` or `requestWalletRecoveryOTPEndpoint` in `OpenfortProvider`.',
            ],
          }),
      ...options,
    })
  }
}
