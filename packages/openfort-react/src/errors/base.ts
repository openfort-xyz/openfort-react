import { isSensitiveKey, REDACTED, redactSensitiveText } from '../utils/redact.js'
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
  /**
   * The message passed to the constructor, without the composed context.
   *
   * Compare against this rather than `message`. `message` carries a version
   * footer, so it changes every release — matching on it breaks on upgrade, and
   * grouping reports by it produces a fresh fingerprint per SDK version.
   */
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

    // An explicit `details` still applies when the cause is an OpenfortError
    // that carries none of its own, otherwise the caller's context is lost.
    const rawDetails =
      options.cause instanceof OpenfortError
        ? options.cause.details || options.details || ''
        : options.cause?.message || options.details || ''

    // `details` is built from a wrapped error's message, which routinely holds a
    // credentialed RPC URL or a serialized auth response. It lands in
    // `error.message`, so it never passes through the logger's redaction.
    const details = redactSensitiveText(rawDetails)
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

    // Non-enumerable, matching what `super(msg, { cause })` produces natively.
    // An enumerable `cause` makes `JSON.stringify` throw on a cyclic chain, and
    // wrapping code does sometimes re-attach an outer error as a deeper cause.
    if (options.cause) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: options.cause,
      })
    }
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

function walk(err: unknown, fn?: (err: unknown) => boolean, seen = new Set<unknown>()): unknown {
  if (fn?.(err)) return err
  // Cause chains can be cyclic: wrapping code sometimes re-attaches an outer
  // error as a deeper cause, and this runs on the render path.
  if (err != null && typeof err === 'object') {
    if (seen.has(err)) return err
    seen.add(err)
    if ('cause' in err && err.cause != null) return walk(err.cause, fn, seen)
  }
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
    // The result becomes an `Error` message and, through `details`, part of a
    // composed message a consumer logs or reports. A rejected auth response
    // serialized whole would carry its token straight into that text.
    const serialized = JSON.stringify(value, (key, nestedValue: unknown) => {
      if (isSensitiveKey(key)) return REDACTED
      if (typeof nestedValue === 'bigint') return `${nestedValue}n`
      if (typeof nestedValue === 'string') return redactSensitiveText(nestedValue)
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

/**
 * The one-line message a UI should render for `error`.
 *
 * An `OpenfortError`'s `message` is the composed multi-line block ending in a
 * `Version:` footer — for logs and reports, not for a modal. Rendering surfaces
 * use the short message and fall back through the parts that stay one line.
 */
export function toDisplayMessage(error: unknown): string {
  if (error instanceof OpenfortError) return error.shortMessage || error.details || error.message
  return toError(error).message
}
