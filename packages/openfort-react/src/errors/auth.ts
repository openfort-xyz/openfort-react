import { OpenfortError, type OpenfortErrorOptions } from './base.js'

/**
 * An authentication flow (login, signup, link, verify, sign out) failed.
 *
 * @example
 * ```ts
 * import { AuthenticationError } from '@openfort/react'
 *
 * const error = new AuthenticationError('Email verification failed.')
 * console.log(error.shortMessage)
 * ```
 */
export class AuthenticationError extends OpenfortError {
  override name = 'AuthenticationError'

  constructor(shortMessage: string, options: OpenfortErrorOptions = {}) {
    super(shortMessage, options)
  }
}

/**
 * An operation needing a signed-in user ran without a session.
 *
 * @example
 * ```ts
 * import { NotAuthenticatedError } from '@openfort/react'
 *
 * const error = new NotAuthenticatedError()
 * console.log(error.name)
 * ```
 */
export class NotAuthenticatedError extends AuthenticationError {
  override name = 'NotAuthenticatedError'

  constructor(shortMessage = 'Not authenticated.', options: OpenfortErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['Sign the user in before calling this action.'],
      ...options,
    })
  }
}
