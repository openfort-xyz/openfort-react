import { redactSensitiveText } from '../utils/redact.js'
import { OpenfortError, type OpenfortErrorOptions } from './base.js'

/**
 * The SDK reached a branch it has no implementation for, such as an unknown asset or transaction format.
 *
 * @example
 * ```ts
 * import { UnsupportedOperationError } from '@openfort/react'
 *
 * const error = new UnsupportedOperationError({ operation: 'Legacy transaction signing' })
 * console.log(error.shortMessage)
 * ```
 */
export class UnsupportedOperationError extends OpenfortError {
  override name = 'UnsupportedOperationError'

  constructor({ operation, ...options }: OpenfortErrorOptions & { operation: string }) {
    super(`${operation} is not supported.`, options)
  }
}

/**
 * An HTTP call to an Openfort or partner API returned a non-OK response.
 *
 * `status` and `body` are kept on the instance so a caller can retry or report
 * without re-parsing the composed message.
 *
 * @example
 * ```ts
 * import { ApiRequestError } from '@openfort/react'
 *
 * const error = new ApiRequestError({ operation: 'Create funding session', status: 503 })
 * if (error.status === 503) console.log('Try again later')
 * ```
 */
export class ApiRequestError extends OpenfortError {
  override name = 'ApiRequestError'

  /** HTTP status code of the failed response. */
  status?: number | undefined
  /** Server-supplied error text, when the response carried one. */
  body?: string | undefined

  constructor({
    operation,
    status,
    body,
    ...options
  }: OpenfortErrorOptions & {
    operation: string
    status?: number | undefined
    body?: string | undefined
  }) {
    super(status === undefined ? `${operation} failed.` : `${operation} failed (${status}).`, {
      ...options,
      ...(body ? { details: body } : {}),
    })
    this.status = status
    // Redacted like `details`: `body` is enumerable, so it survives
    // `JSON.stringify(error)` and would otherwise ship the raw response.
    this.body = body === undefined ? undefined : redactSensitiveText(body)
  }
}
