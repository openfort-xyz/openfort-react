const PREFIX = '[Openfort-React]'
const REDACTED = '[REDACTED]'
const TRUNCATED = '[TRUNCATED]'
const UNSERIALIZABLE = '[UNSERIALIZABLE]'
const FUNCTION = '[FUNCTION]'
const MAX_DEPTH = 12

const SENSITIVE_KEYS = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'password',
  'recoverypassword',
  'encryptionsession',
  'recoveryshare',
  'shieldencryptionkey',
  'passkeykey',
  'privatekey',
  'secretkey',
  'encryptionkey',
  'passkeyderivedkey',
  'clientsecret',
  'apikey',
])

const normalizedKey = (key: string) => key.toLowerCase().replaceAll(/[^a-z0-9]/g, '')

const isSensitiveKey = (key: unknown): key is string =>
  typeof key === 'string' && SENSITIVE_KEYS.has(normalizedKey(key))

const SERIALIZED_SENSITIVE_VALUE =
  /((?:["']?)(?:(?:access|refresh|id)[_-]?token|token|private[_-]?key|client[_-]?secret|api[_-]?key|encryption[_-]?session|recovery[_-]?share|shield[_-]?encryption[_-]?key|passkey[_-]?(?:derived[_-]?)?key|password|recovery[_-]?password|encryption[_-]?key|secret[_-]?key)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;)\]}&]+)/gi

const SERIALIZED_AUTH_HEADER = /\b((?:proxy[_-]?)?authorization|cookie|set[_-]?cookie)(\s*[:=]\s*)[^,\r\n)\]}]+/gi
const NETWORK_URL = /\b(?:https?|wss?):\/\/[^\s,;)}"']+/gi

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value)
    const hasSensitiveLocation =
      url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== ''
    return hasSensitiveLocation ? `${url.origin}/${REDACTED}` : url.origin
  } catch {
    return REDACTED
  }
}

const sanitizeString = (value: string) =>
  value
    .replaceAll(NETWORK_URL, (url: string) => sanitizeUrl(url))
    .replaceAll(/\bBearer\s+[^\s,;)\]}"']+/gi, 'Bearer [REDACTED]')
    .replaceAll(SERIALIZED_AUTH_HEADER, (_match, name: string, separator: string) => {
      return `${name}${separator}${REDACTED}`
    })
    .replaceAll(SERIALIZED_SENSITIVE_VALUE, (_match, prefix: string, credential: string) => {
      const quote = credential.startsWith('"') ? '"' : credential.startsWith("'") ? "'" : ''
      return `${prefix}${quote}${REDACTED}${quote}`
    })

function sanitizeForLogging(value: unknown, seen = new WeakMap<object, unknown>(), depth = 0): unknown {
  if (typeof value === 'string') return sanitizeString(value)
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

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) continue

    const sanitizedValue = isSensitiveKey(key)
      ? REDACTED
      : 'value' in descriptor
        ? sanitizeForLogging(descriptor.value, seen, depth + 1)
        : '[ACCESSOR]'

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
