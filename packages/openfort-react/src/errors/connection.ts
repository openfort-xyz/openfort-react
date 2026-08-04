import type { OpenfortErrorOptions } from './base.js'
import { WalletError } from './wallet.js'

type ConnectionErrorOptions = Omit<OpenfortErrorOptions, 'type'>

/**
 * A connector was requested by id that is absent from the wagmi config.
 *
 * @example
 * ```ts
 * import { ConnectorNotFoundError } from '@openfort/react'
 *
 * const error = new ConnectorNotFoundError({ connectorId: 'injected' })
 * console.log(error.shortMessage)
 * ```
 */
export class ConnectorNotFoundError extends WalletError {
  override name = 'ConnectorNotFoundError'

  constructor({ connectorId, ...options }: ConnectionErrorOptions & { connectorId?: string | undefined } = {}) {
    super(connectorId ? `Connector "${connectorId}" not found.` : 'Connector not found.', options)
  }
}

/**
 * A connector was passed to a flow that only handles a different connector type.
 *
 * @example
 * ```ts
 * import { ConnectorTypeMismatchError } from '@openfort/react'
 *
 * const error = new ConnectorTypeMismatchError({ expected: 'oauth', received: 'injected' })
 * console.log(error.shortMessage)
 * ```
 */
export class ConnectorTypeMismatchError extends WalletError {
  override name = 'ConnectorTypeMismatchError'

  constructor({
    expected,
    received,
    ...options
  }: ConnectionErrorOptions & { expected: string; received?: string | undefined }) {
    super(`Expected a "${expected}" connector but received ${received ? `"${received}"` : 'none'}.`, options)
  }
}

/**
 * No EIP-1193 provider (or equivalent) is available to serve the request.
 *
 * @example
 * ```ts
 * import { ProviderNotFoundError } from '@openfort/react'
 *
 * const error = new ProviderNotFoundError()
 * console.log(error.name)
 * ```
 */
export class ProviderNotFoundError extends WalletError {
  override name = 'ProviderNotFoundError'

  constructor(shortMessage = 'Provider not found.', options: ConnectionErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * A SIWE message could not be built, so wallet authentication cannot start.
 *
 * @example
 * ```ts
 * import { SiweMessageError } from '@openfort/react'
 *
 * const error = new SiweMessageError()
 * console.log(error.name)
 * ```
 */
export class SiweMessageError extends WalletError {
  override name = 'SiweMessageError'

  constructor(shortMessage = 'SIWE message creation failed.', options: ConnectionErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['SIWE requires a browser environment with `window` available.'],
      ...options,
    })
  }
}
