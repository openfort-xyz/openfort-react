import { OpenfortError, type OpenfortErrorOptions } from './base.js'
import { OpenfortConfigError } from './config.js'

/**
 * A funding action ran without the funding service being pointed at a host.
 *
 * @example
 * ```ts
 * import { FundingNotConfiguredError } from '@openfort/react'
 *
 * const error = new FundingNotConfiguredError()
 * console.log(error.name)
 * ```
 */
export class FundingNotConfiguredError extends OpenfortConfigError {
  override name = 'FundingNotConfiguredError'

  constructor(options: OpenfortErrorOptions = {}) {
    super('Funding is not configured.', {
      metaMessages: ['Set `uiConfig.fundingBaseUrl` on `OpenfortProvider`.'],
      ...options,
    })
  }
}

/**
 * A funding session or quote request failed.
 *
 * @example
 * ```ts
 * import { FundingError } from '@openfort/react'
 *
 * const error = new FundingError('Unable to create a funding quote.')
 * console.log(error.shortMessage)
 * ```
 */
export class FundingError extends OpenfortError {
  override name = 'FundingError'

  constructor(shortMessage: string, options: OpenfortErrorOptions = {}) {
    super(shortMessage, options)
  }
}
