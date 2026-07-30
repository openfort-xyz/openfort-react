import type { OpenfortErrorOptions } from './base.js'
import { WalletError } from './wallet.js'

type ConnectionErrorOptions = Omit<OpenfortErrorOptions, 'type'>

export type ConnectorNotFoundErrorType = ConnectorNotFoundError & { name: 'ConnectorNotFoundError' }

/** A connector was requested by id that is absent from the wagmi config. */
export class ConnectorNotFoundError extends WalletError {
  override name = 'ConnectorNotFoundError'

  constructor({ connectorId, ...options }: ConnectionErrorOptions & { connectorId?: string | undefined } = {}) {
    super(connectorId ? `Connector "${connectorId}" not found.` : 'Connector not found.', options)
  }
}

export type ConnectorTypeMismatchErrorType = ConnectorTypeMismatchError & { name: 'ConnectorTypeMismatchError' }

/** A connector was passed to a flow that only handles a different connector type. */
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

export type ProviderNotFoundErrorType = ProviderNotFoundError & { name: 'ProviderNotFoundError' }

/** No EIP-1193 provider (or equivalent) is available to serve the request. */
export class ProviderNotFoundError extends WalletError {
  override name = 'ProviderNotFoundError'

  constructor(shortMessage = 'Provider not found.', options: ConnectionErrorOptions = {}) {
    super(shortMessage, options)
  }
}

export type SiweMessageErrorType = SiweMessageError & { name: 'SiweMessageError' }

/** A SIWE message could not be built, so wallet authentication cannot start. */
export class SiweMessageError extends WalletError {
  override name = 'SiweMessageError'

  constructor(shortMessage = 'SIWE message creation failed.', options: ConnectionErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['SIWE requires a browser environment with `window` available.'],
      ...options,
    })
  }
}
