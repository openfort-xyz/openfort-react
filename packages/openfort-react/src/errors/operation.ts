import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type OperationErrorOptions = Omit<OpenfortErrorOptions, 'type'>

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

  constructor({ operation, ...options }: OperationErrorOptions & { operation: string }) {
    super(`${operation} is not supported.`, { ...options, type: OpenfortReactErrorType.UNEXPECTED_ERROR })
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
  }: OperationErrorOptions & {
    operation: string
    status?: number | undefined
    body?: string | undefined
  }) {
    super(status === undefined ? `${operation} failed.` : `${operation} failed (${status}).`, {
      ...options,
      ...(body ? { details: body } : {}),
      type: OpenfortReactErrorType.UNEXPECTED_ERROR,
    })
    this.status = status
    this.body = body
  }
}
