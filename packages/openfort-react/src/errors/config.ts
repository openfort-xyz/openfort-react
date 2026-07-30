import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type ConfigErrorOptions = Omit<OpenfortErrorOptions, 'type'>

export type OpenfortConfigErrorType = OpenfortConfigError & { name: 'OpenfortConfigError' }

/** The SDK was given an incomplete or contradictory configuration. */
export class OpenfortConfigError extends OpenfortError {
  override name = 'OpenfortConfigError'

  constructor(shortMessage: string, options: ConfigErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.CONFIGURATION_ERROR })
  }
}

export type WalletConfigNotFoundErrorType = WalletConfigNotFoundError & { name: 'WalletConfigNotFoundError' }

/** A wallet operation ran without `walletConfig` on `OpenfortProvider`. */
export class WalletConfigNotFoundError extends OpenfortConfigError {
  override name = 'WalletConfigNotFoundError'

  constructor(options: ConfigErrorOptions = {}) {
    super('Wallet config not found.', {
      metaMessages: ['Pass `walletConfig` to `OpenfortProvider` to enable embedded wallets.'],
      ...options,
    })
  }
}

export type ClientNotInitializedErrorType = ClientNotInitializedError & { name: 'ClientNotInitializedError' }

/** The Openfort client was used before `OpenfortProvider` finished initializing it. */
export class ClientNotInitializedError extends OpenfortConfigError {
  override name = 'ClientNotInitializedError'

  constructor(options: ConfigErrorOptions = {}) {
    super('Openfort client is not initialized.', {
      metaMessages: ['Render this hook inside `OpenfortProvider` and wait for `isReady` before calling it.'],
      ...options,
    })
  }
}

export type ChainNotConfiguredErrorType = ChainNotConfiguredError & { name: 'ChainNotConfiguredError' }

/** A chain was requested that is absent from the configured chain list. */
export class ChainNotConfiguredError extends OpenfortConfigError {
  override name = 'ChainNotConfiguredError'

  constructor({ chainId, ...options }: ConfigErrorOptions & { chainId?: number | undefined } = {}) {
    super(chainId === undefined ? 'No chain configured.' : `Chain ${chainId} is not configured.`, {
      metaMessages: ['Add the chain to `walletConfig.ethereum.chains` on `OpenfortProvider`.'],
      ...options,
    })
  }
}

export type RpcUrlNotConfiguredErrorType = RpcUrlNotConfiguredError & { name: 'RpcUrlNotConfiguredError' }

/** A chain is configured but has no RPC endpoint to talk to. */
export class RpcUrlNotConfiguredError extends OpenfortConfigError {
  override name = 'RpcUrlNotConfiguredError'

  constructor({ chainId, ...options }: ConfigErrorOptions & { chainId: number }) {
    super(`No RPC URL configured for chain ${chainId}.`, {
      metaMessages: [`Set \`walletConfig.ethereum.rpcUrls[${chainId}]\` on \`OpenfortProvider\`.`],
      ...options,
    })
  }
}

export type SolanaClusterNotSupportedErrorType = SolanaClusterNotSupportedError & {
  name: 'SolanaClusterNotSupportedError'
}

/** A Solana cluster was named that the SDK has no default endpoint for. */
export class SolanaClusterNotSupportedError extends OpenfortConfigError {
  override name = 'SolanaClusterNotSupportedError'

  constructor({ cluster, ...options }: ConfigErrorOptions & { cluster: string }) {
    super(`Unknown Solana cluster "${cluster}".`, {
      metaMessages: ['Provide `rpcUrls` in `walletConfig.solana` for this cluster.'],
      ...options,
    })
  }
}
