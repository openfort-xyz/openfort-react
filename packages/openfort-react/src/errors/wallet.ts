import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type WalletErrorOptions = Omit<OpenfortErrorOptions, 'type'>

/** The chain family a wallet error happened on, used to build its message. */
export type WalletChain = 'Ethereum' | 'Solana'

/**
 * An embedded or external wallet operation failed.
 *
 * @example
 * ```ts
 * import { WalletError } from '@openfort/react'
 *
 * const error = new WalletError('The wallet request failed.')
 * console.log(error.shortMessage)
 * ```
 */
export class WalletError extends OpenfortError {
  override name = 'WalletError'

  constructor(shortMessage: string, options: WalletErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.WALLET_ERROR })
  }
}

/**
 * Creating an embedded wallet failed.
 *
 * @example
 * ```ts
 * import { WalletCreationError } from '@openfort/react'
 *
 * const error = new WalletCreationError({ chain: 'Ethereum' })
 * console.log(error.shortMessage)
 * ```
 */
export class WalletCreationError extends WalletError {
  override name = 'WalletCreationError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to create ${chain} wallet.`, options)
  }
}

/**
 * Importing an existing key into an embedded wallet failed.
 *
 * @example
 * ```ts
 * import { WalletImportError } from '@openfort/react'
 *
 * const error = new WalletImportError({ chain: 'Solana' })
 * console.log(error.shortMessage)
 * ```
 */
export class WalletImportError extends WalletError {
  override name = 'WalletImportError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to import ${chain} wallet.`, options)
  }
}

/**
 * Switching the active embedded wallet failed.
 *
 * @example
 * ```ts
 * import { SetActiveWalletError } from '@openfort/react'
 *
 * const error = new SetActiveWalletError({ chain: 'Ethereum' })
 * console.log(error.shortMessage)
 * ```
 */
export class SetActiveWalletError extends WalletError {
  override name = 'SetActiveWalletError'

  constructor({ chain, ...options }: WalletErrorOptions & { chain: WalletChain }) {
    super(`Failed to set active ${chain} wallet.`, options)
  }
}

/**
 * No wallet is available for the requested operation.
 *
 * @example
 * ```ts
 * import { WalletNotFoundError } from '@openfort/react'
 *
 * const error = new WalletNotFoundError()
 * console.log(error.name)
 * ```
 */
export class WalletNotFoundError extends WalletError {
  override name = 'WalletNotFoundError'

  constructor(shortMessage = 'Wallet not found.', options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * A wallet exists but is not connected, so it cannot sign or read accounts.
 *
 * @example
 * ```ts
 * import { WalletNotConnectedError } from '@openfort/react'
 *
 * const error = new WalletNotConnectedError()
 * console.log(error.name)
 * ```
 */
export class WalletNotConnectedError extends WalletError {
  override name = 'WalletNotConnectedError'

  constructor(shortMessage = 'Wallet not connected.', options: WalletErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['Connect a wallet before calling this action.'],
      ...options,
    })
  }
}

/**
 * The embedded wallet provider has not finished booting.
 *
 * @example
 * ```ts
 * import { ProviderNotReadyError } from '@openfort/react'
 *
 * const error = new ProviderNotReadyError()
 * console.log(error.name)
 * ```
 */
export class ProviderNotReadyError extends WalletError {
  override name = 'ProviderNotReadyError'

  constructor(shortMessage = 'Provider not ready yet.', options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * Configuring or running embedded wallet recovery failed.
 *
 * @example
 * ```ts
 * import { RecoveryError } from '@openfort/react'
 *
 * const error = new RecoveryError('Automatic recovery failed.')
 * console.log(error.shortMessage)
 * ```
 */
export class RecoveryError extends WalletError {
  override name = 'RecoveryError'

  constructor(shortMessage: string, options: WalletErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * Recovery cannot proceed until the user supplies a one-time code.
 *
 * `canRequestOtp` reflects whether the app configured a way to send that code;
 * when it did not, the message says which option to set.
 *
 * @example
 * ```ts
 * import { OtpRequiredError } from '@openfort/react'
 *
 * const error = new OtpRequiredError({ canRequestOtp: true })
 * console.log(error.shortMessage)
 * ```
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
