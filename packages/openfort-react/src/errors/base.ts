import { OPENFORT_VERSION } from '../version.js'

export type OpenfortErrorOptions = {
  /** Underlying error this one wraps. Always surfaced as `error.cause`. */
  cause?: Error | undefined
  /** Low-level explanation appended as `Details:`. Inherited from an `OpenfortError` cause. */
  details?: string | undefined
  /** Path appended to {@link OpenfortError.docsBaseUrl} to build a `Docs:` link. */
  docsPath?: string | undefined
  /** Extra lines rendered between the short message and the docs link. */
  metaMessages?: string[] | undefined
}

/**
 * Base class for every error the SDK produces.
 *
 * `message` is composed from the short message, meta messages, a docs link, the
 * details of the underlying failure and the SDK version, so a pasted stack trace
 * carries enough context to diagnose the problem without a reproduction.
 */
export class OpenfortError extends Error {
  /** Low-level explanation of the failure, usually the wrapped error's message. */
  details: string
  /** Path under {@link docsBaseUrl} documenting this failure, when one exists. */
  docsPath?: string | undefined
  /** Extra context lines rendered under the short message. */
  metaMessages?: string[] | undefined
  /** The message passed to the constructor, without the composed context. */
  shortMessage: string

  override name = 'OpenfortError'

  get docsBaseUrl() {
    return 'https://www.openfort.io/docs'
  }

  get version() {
    return `@openfort/react@${OPENFORT_VERSION}`
  }

  constructor(shortMessage: string, options: OpenfortErrorOptions = {}) {
    super()

    const details =
      options.cause instanceof OpenfortError
        ? options.cause.details
        : options.cause?.message
          ? options.cause.message
          : (options.details ?? '')
    const docsPath =
      options.cause instanceof OpenfortError ? options.cause.docsPath || options.docsPath : options.docsPath

    this.message = [
      shortMessage || 'An error occurred.',
      '',
      ...(options.metaMessages ? [...options.metaMessages, ''] : []),
      ...(docsPath ? [`Docs: ${this.docsBaseUrl}${docsPath}`] : []),
      ...(details ? [`Details: ${details}`] : []),
      `Version: ${this.version}`,
    ].join('\n')

    if (options.cause) this.cause = options.cause
    this.details = details
    this.docsPath = docsPath
    this.metaMessages = options.metaMessages
    this.shortMessage = shortMessage
  }

  /**
   * Walks the `cause` chain and returns the first error matching `fn`.
   *
   * Without a predicate it returns the deepest cause; when nothing matches it
   * returns the deepest cause too, so the result is never `undefined`. Callers
   * looking for a specific error must re-test the returned value.
   */
  walk(fn?: (err: unknown) => boolean) {
    return walk(this, fn)
  }
}

function walk(err: unknown, fn?: (err: unknown) => boolean): unknown {
  if (fn?.(err)) return err
  if (err != null && typeof err === 'object' && 'cause' in err && err.cause != null) return walk(err.cause, fn)
  return err
}

/**
 * Coerces an unknown thrown value into an `Error` so it can be used as a `cause`.
 *
 * `catch` binds `unknown`, but rejections are not always `Error` instances —
 * strings and plain objects both show up in practice.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  if (typeof value === 'bigint') return new Error(`${value}n`)
  if (value === undefined || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'symbol') {
    return new Error(String(value))
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === 'bigint') return `${nestedValue}n`
      if (nestedValue != null && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) return '[Circular]'
        seen.add(nestedValue)
      }
      return nestedValue
    })
    if (serialized !== undefined) return new Error(serialized)
  } catch {
    // Some thrown values expose hostile serialization hooks; the string fallback remains safe.
  }

  try {
    return new Error(String(value))
  } catch {
    return new Error('Unknown thrown value')
  }
}

/**
 * Wraps an unknown thrown value with `wrap`, passing through values that are
 * already Openfort errors.
 *
 * Use this where a failure has already been classified deeper in the stack and
 * the outer layer adds nothing; where the outer layer does add context, wrap
 * unconditionally with `{ cause: toError(value) }` instead so both messages survive.
 */
export function asOpenfortError(cause: unknown, wrap: (cause: Error) => OpenfortError): OpenfortError {
  if (cause instanceof OpenfortError) return cause
  return wrap(toError(cause))
}
