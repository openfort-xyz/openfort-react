import { OpenfortError, type OpenfortErrorOptions } from './base.js'

/**
 * An argument reached an action hook in a shape it cannot act on.
 *
 * @example
 * ```ts
 * import { ValidationError } from '@openfort/react'
 *
 * const error = new ValidationError('The transaction request is invalid.')
 * console.log(error.shortMessage)
 * ```
 */
export class ValidationError extends OpenfortError {
  override name = 'ValidationError'

  constructor(shortMessage: string, options: OpenfortErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * A required argument was omitted or empty.
 *
 * @example
 * ```ts
 * import { MissingParameterError } from '@openfort/react'
 *
 * const error = new MissingParameterError({ params: ['email', 'password'] })
 * console.log(error.shortMessage)
 * ```
 */
export class MissingParameterError extends ValidationError {
  override name = 'MissingParameterError'

  /** Names the missing arguments so the message points at the exact call site fix. */
  constructor({ params, ...options }: OpenfortErrorOptions & { params: string[] }) {
    const list = params.map((param) => `\`${param}\``)
    const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list.join('')
    super(`${joined} ${params.length > 1 ? 'are' : 'is'} required.`, options)
  }
}

/**
 * An email address failed the SDK's format check before any network call.
 *
 * @example
 * ```ts
 * import { InvalidEmailError } from '@openfort/react'
 *
 * const error = new InvalidEmailError({ email: 'user@example' })
 * console.log(error.shortMessage)
 * ```
 */
export class InvalidEmailError extends ValidationError {
  override name = 'InvalidEmailError'

  constructor({ email, ...options }: OpenfortErrorOptions & { email?: string | undefined } = {}) {
    super(email ? `Invalid email: "${email}".` : 'Invalid email.', options)
  }
}
