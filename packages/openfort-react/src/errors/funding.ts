import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'
import { OpenfortConfigError } from './config.js'

type FundingErrorOptions = Omit<OpenfortErrorOptions, 'type'>

export type FundingNotConfiguredErrorType = FundingNotConfiguredError & { name: 'FundingNotConfiguredError' }

/** A funding action ran without the funding service being pointed at a host. */
export class FundingNotConfiguredError extends OpenfortConfigError {
  override name = 'FundingNotConfiguredError'

  constructor(options: FundingErrorOptions = {}) {
    super('Funding is not configured.', {
      metaMessages: ['Set `uiConfig.fundingBaseUrl` on `OpenfortProvider`.'],
      ...options,
    })
  }
}

export type FundingErrorType = FundingError & { name: 'FundingError' }

/** A funding session or quote request failed. */
export class FundingError extends OpenfortError {
  override name = 'FundingError'

  constructor(shortMessage: string, options: FundingErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.UNEXPECTED_ERROR })
  }
}
