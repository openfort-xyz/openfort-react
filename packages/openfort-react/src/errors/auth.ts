import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type AuthErrorOptions = Omit<OpenfortErrorOptions, 'type'>

export type AuthenticationErrorType = AuthenticationError & { name: 'AuthenticationError' }

/** An authentication flow (login, signup, link, verify, sign out) failed. */
export class AuthenticationError extends OpenfortError {
  override name = 'AuthenticationError'

  constructor(shortMessage: string, options: AuthErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.AUTHENTICATION_ERROR })
  }
}

export type NotAuthenticatedErrorType = NotAuthenticatedError & { name: 'NotAuthenticatedError' }

/** An operation needing a signed-in user ran without a session. */
export class NotAuthenticatedError extends AuthenticationError {
  override name = 'NotAuthenticatedError'

  constructor(shortMessage = 'Not authenticated.', options: AuthErrorOptions = {}) {
    super(shortMessage, {
      metaMessages: ['Sign the user in before calling this action.'],
      ...options,
    })
  }
}
