import { isSensitiveKey, REDACTED, redactSensitiveText } from './redact.js'

const PREFIX = '[Openfort-React]'
const TRUNCATED = '[TRUNCATED]'
const UNSERIALIZABLE = '[UNSERIALIZABLE]'
const FUNCTION = '[FUNCTION]'
const ACCESSOR = '[ACCESSOR]'
const MAX_DEPTH = 12

/**
 * Rebuilds `value` with every credential removed, so nothing reaches the
 * console that the redaction rules would have caught in a string.
 */
function sanitizeForLogging(value: unknown, seen = new WeakMap<object, unknown>(), depth = 0): unknown {
  if (typeof value === 'string') return redactSensitiveText(value)
  if (typeof value === 'function') return FUNCTION
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return TRUNCATED

  const existing = seen.get(value)
  if (existing !== undefined) return existing

  if (value instanceof Date || value instanceof RegExp) return value

  if (Array.isArray(value)) {
    const sanitized: unknown[] = []
    seen.set(value, sanitized)
    for (const item of value) sanitized.push(sanitizeForLogging(item, seen, depth + 1))
    return sanitized
  }

  if (value instanceof Map) {
    const sanitized = new Map<unknown, unknown>()
    seen.set(value, sanitized)
    for (const [key, item] of value) {
      sanitized.set(
        sanitizeForLogging(key, seen, depth + 1),
        isSensitiveKey(key) ? REDACTED : sanitizeForLogging(item, seen, depth + 1)
      )
    }
    return sanitized
  }

  if (value instanceof Set) {
    const sanitized = new Set<unknown>()
    seen.set(value, sanitized)
    for (const item of value) sanitized.add(sanitizeForLogging(item, seen, depth + 1))
    return sanitized
  }

  const sanitized: Record<PropertyKey, unknown> | Error = value instanceof Error ? new Error() : {}
  seen.set(value, sanitized)

  // `name`, `message` and `stack` are how a console renders an error and how a
  // reporter groups it. V8 exposes `stack` as an own accessor, so the generic
  // branch below would replace it with a placeholder and leave the error
  // unreadable. Reading the property invokes that accessor deliberately — safe
  // on a real Error, and guarded for a subclass that swaps in a thrower.
  if (value instanceof Error) {
    for (const key of ['name', 'message', 'stack'] as const) {
      try {
        const text = value[key]
        if (typeof text === 'string') {
          Object.defineProperty(sanitized, key, {
            configurable: true,
            enumerable: false,
            writable: true,
            value: redactSensitiveText(text),
          })
        }
      } catch {
        // A getter that throws tells us nothing; leave the Error's own default.
      }
    }
  }

  for (const key of Reflect.ownKeys(value)) {
    if (value instanceof Error && (key === 'name' || key === 'message' || key === 'stack')) continue

    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) continue

    const sanitizedValue = isSensitiveKey(key)
      ? REDACTED
      : 'value' in descriptor
        ? sanitizeForLogging(descriptor.value, seen, depth + 1)
        : ACCESSOR

    Object.defineProperty(sanitized, key, {
      configurable: true,
      enumerable: descriptor.enumerable,
      writable: true,
      value: sanitizedValue,
    })
  }

  return sanitized
}

const sanitizeArgs = (args: unknown[]) => args.map((argument) => sanitizeForLogging(argument))

function sanitizeArgsWithoutThrowing(args: unknown[]): unknown[] {
  try {
    return sanitizeArgs(args)
  } catch {
    // Never fall back to the original value: the trap that made inspection fail
    // may be concealing a credential-bearing property.
    return [UNSERIALIZABLE]
  }
}

function emit(method: 'log' | 'error' | 'warn', args: unknown[]): void {
  try {
    // biome-ignore lint/suspicious/noConsole: this is the SDK's guarded console boundary
    console[method](PREFIX, ...sanitizeArgsWithoutThrowing(args))
  } catch {
    // Host applications can replace console methods with throwing functions.
    // Logging must never alter an SDK operation or callback settlement.
  }
}

let debugLogsEnabled = false

/**
 * Toggles the verbose `logger.log` output. Warnings and errors are unaffected: they always emit.
 *
 * @param enabled - Whether `logger.log` should write to the console.
 */
export const setDebugLogsEnabled = (enabled: boolean) => {
  debugLogsEnabled = enabled
}

export const logger = {
  log: (...args: unknown[]) => {
    if (!debugLogsEnabled) return
    emit('log', args)
  },
  error: (...args: unknown[]) => emit('error', args),
  warn: (...args: unknown[]) => emit('warn', args),
}
