import { OpenfortError, type OpenfortErrorOptions, OpenfortReactErrorType } from './base.js'

type ValidationErrorOptions = Omit<OpenfortErrorOptions, 'type'>

export type ValidationErrorType = ValidationError & { name: 'ValidationError' }

/** An argument reached an action hook in a shape it cannot act on. */
export class ValidationError extends OpenfortError {
  override name = 'ValidationError'

  constructor(shortMessage: string, options: ValidationErrorOptions = {}) {
    super(shortMessage, { ...options, type: OpenfortReactErrorType.VALIDATION_ERROR })
  }
}

export type MissingParameterErrorType = MissingParameterError & { name: 'MissingParameterError' }

/** A required argument was omitted or empty. */
export class MissingParameterError extends ValidationError {
  override name = 'MissingParameterError'

  /** Names the missing arguments so the message points at the exact call site fix. */
  constructor({ params, ...options }: ValidationErrorOptions & { params: string[] }) {
    const list = params.map((param) => `\`${param}\``)
    const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list.join('')
    super(`${joined} ${params.length > 1 ? 'are' : 'is'} required.`, options)
  }
}

export type InvalidEmailErrorType = InvalidEmailError & { name: 'InvalidEmailError' }

/** An email address failed the SDK's format check before any network call. */
export class InvalidEmailError extends ValidationError {
  override name = 'InvalidEmailError'

  constructor({ email, ...options }: ValidationErrorOptions & { email?: string | undefined } = {}) {
    super(email ? `Invalid email: "${email}".` : 'Invalid email.', options)
  }
}
