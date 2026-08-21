import { OpenfortError, type OpenfortErrorOptions } from './base.js'

/**
 * The SDK was given an incomplete or contradictory configuration.
 *
 * @example
 * ```ts
 * import { OpenfortConfigError } from '@openfort/react'
 *
 * const error = new OpenfortConfigError('The wallet configuration is invalid.')
 * console.log(error.shortMessage)
 * ```
 */
export class OpenfortConfigError extends OpenfortError {
  override name = 'OpenfortConfigError'

  constructor(shortMessage: string, options: OpenfortErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * A wallet operation ran without `walletConfig` on `OpenfortProvider`.
 *
 * @example
 * ```ts
 * import { WalletConfigNotFoundError } from '@openfort/react'
 *
 * const error = new WalletConfigNotFoundError()
 * console.log(error.name)
 * ```
 */
export class WalletConfigNotFoundError extends OpenfortConfigError {
  override name = 'WalletConfigNotFoundError'

  constructor(options: OpenfortErrorOptions = {}) {
    super('Wallet config not found.', {
      metaMessages: ['Pass `walletConfig` to `OpenfortProvider` to enable embedded wallets.'],
      ...options,
    })
  }
}

/**
 * The Openfort client was used before `OpenfortProvider` finished initializing it.
 *
 * @example
 * ```ts
 * import { ClientNotInitializedError } from '@openfort/react'
 *
 * const error = new ClientNotInitializedError()
 * console.log(error.name)
 * ```
 */
export class ClientNotInitializedError extends OpenfortConfigError {
  override name = 'ClientNotInitializedError'

  constructor(options: OpenfortErrorOptions = {}) {
    super('Openfort client is not initialized.', {
      metaMessages: ['Render this hook inside `OpenfortProvider` and wait for `isReady` before calling it.'],
      ...options,
    })
  }
}

/**
 * A chain was requested that is absent from the configured chain list.
 *
 * @example
 * ```ts
 * import { ChainNotConfiguredError } from '@openfort/react'
 *
 * const error = new ChainNotConfiguredError({ chainId: 8453 })
 * console.log(error.shortMessage)
 * ```
 */
export class ChainNotConfiguredError extends OpenfortConfigError {
  override name = 'ChainNotConfiguredError'

  constructor({ chainId, ...options }: OpenfortErrorOptions & { chainId?: number | undefined } = {}) {
    super(chainId === undefined ? 'No chain configured.' : `Chain ${chainId} is not configured.`, {
      metaMessages: ['Add the chain to the `chains` passed to your Wagmi config.'],
      ...options,
    })
  }
}

/**
 * A chain is configured but has no RPC endpoint to talk to.
 *
 * @example
 * ```ts
 * import { RpcUrlNotConfiguredError } from '@openfort/react'
 *
 * const error = new RpcUrlNotConfiguredError({ chainId: 8453 })
 * console.log(error.shortMessage)
 * ```
 */
export class RpcUrlNotConfiguredError extends OpenfortConfigError {
  override name = 'RpcUrlNotConfiguredError'

  constructor({ chainId, ...options }: OpenfortErrorOptions & { chainId: number }) {
    super(`No RPC URL configured for chain ${chainId}.`, {
      metaMessages: [`Set \`walletConfig.ethereum.rpcUrls[${chainId}]\` on \`OpenfortProvider\`.`],
      ...options,
    })
  }
}

/**
 * A Solana cluster was named that the SDK has no default endpoint for.
 *
 * @example
 * ```ts
 * import { SolanaClusterNotSupportedError } from '@openfort/react'
 *
 * const error = new SolanaClusterNotSupportedError({ cluster: 'customnet' })
 * console.log(error.shortMessage)
 * ```
 */
export class SolanaClusterNotSupportedError extends OpenfortConfigError {
  override name = 'SolanaClusterNotSupportedError'

  constructor({ cluster, ...options }: OpenfortErrorOptions & { cluster: string }) {
    super(`Unknown Solana cluster "${cluster}".`, {
      metaMessages: ['Provide `rpcUrls` in `walletConfig.solana` for this cluster.'],
      ...options,
    })
  }
}
