/**
 * Credential redaction shared by the logger and the error taxonomy.
 *
 * Both write text a consumer will see — one to the console, one into
 * `error.message` — so both need the same rules. Keeping them here stops the
 * two drifting apart and leaving one of the paths leaking.
 */

export const REDACTED = '[REDACTED]'

/**
 * Names matched exactly, for words too common to match as a substring.
 * `share` is what Shield calls the recovery share; `sharedConfig` must not match.
 */
const SENSITIVE_KEYS = new Set(['share', 'cookie', 'setcookie', 'jwt', 'bearer', 'otp'])

/**
 * Fragments matched anywhere in the normalized key. A substring rule covers the
 * long tail an exact list cannot: `sessionToken`, `x-access-token`, `authToken`
 * and `userAccessToken` are all credentials, and no list stays ahead of the
 * names a backend invents.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'secret',
  'apikey',
  'privatekey',
  'mnemonic',
  'seedphrase',
  'passphrase',
  'codeverifier',
  'otpcode',
  'passkey',
  'encryptionkey',
  'encryptionsession',
  'recoveryshare',
  'authorization',
  'credential',
]

/**
 * Matched only at the end of a key.
 *
 * `accessToken`, `refreshToken`, `sessionToken` and `x-access-token` are all
 * credentials; `tokenMint`, `tokenAddress`, `tokenProgram` and `tokenId` are
 * public identifiers this SDK logs constantly. A substring rule would redact
 * both and quietly destroy the more useful half.
 */
const SENSITIVE_KEY_SUFFIXES = ['token']

const normalizedKey = (key: string) => key.toLowerCase().replaceAll(/[^a-z0-9]/g, '')

export const isSensitiveKey = (key: unknown): key is string => {
  if (typeof key !== 'string') return false
  const normalized = normalizedKey(key)
  if (SENSITIVE_KEYS.has(normalized)) return true
  if (SENSITIVE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
}

const SERIALIZED_SENSITIVE_VALUE =
  /((?:["']?)(?:(?:access|refresh|id)[_-]?token|token|private[_-]?key|client[_-]?secret|api[_-]?key|encryption[_-]?session|recovery[_-]?share|shield[_-]?encryption[_-]?key|passkey[_-]?(?:derived[_-]?)?key|password|recovery[_-]?password|encryption[_-]?key|secret[_-]?key)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;)\]}&]+)/gi

/**
 * Matches a header name and its value in serialized text. The key may be quoted
 * — `toError` JSON-stringifies non-Error rejections, so these most often arrive
 * as `"set-cookie":"…"` rather than the bare `Set-Cookie: …` header form.
 */
const SERIALIZED_AUTH_HEADER =
  /((?:["']?)(?:set[_-]?cookie|(?:proxy[_-]?)?authorization|cookie)(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n)\]}]+)/gi

const NETWORK_URL = /\b(?:https?|wss?):\/\/[^\s,;)}"']+/gi

/**
 * A JWT carried in prose, with no key name in front of it to match on. The
 * three-segment `eyJ` shape is specific enough not to collide with anything
 * else the SDK writes. Deliberately no rule for bare `0x`-hex or base58: a
 * private key and a transaction hash are the same shape, and redacting every
 * hash would cost more debuggability than it buys.
 */
const BARE_JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g

/**
 * Strips the credentials out of a URL, keeping the origin so the failing host
 * is still identifiable. An RPC URL routinely carries an API key in its path or
 * query, which is why anything past the origin goes.
 */
export function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value)
    const hasSensitiveLocation =
      url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== ''
    return hasSensitiveLocation ? `${url.origin}/${REDACTED}` : url.origin
  } catch {
    return REDACTED
  }
}

/** Replaces the value that follows a matched key, keeping the quoting it arrived with. */
function redactCredentialAfterPrefix(_match: string, prefix: string, credential: string): string {
  const quote = credential.startsWith('"') ? '"' : credential.startsWith("'") ? "'" : ''
  return `${prefix}${quote}${REDACTED}${quote}`
}

/** Redacts every credential shape recognised in a run of text. */
export const redactSensitiveText = (value: string): string =>
  value
    .replaceAll(NETWORK_URL, (url: string) => sanitizeUrl(url))
    .replaceAll(/\bBearer\s+[^\s,;)\]}"']+/gi, `Bearer ${REDACTED}`)
    .replaceAll(SERIALIZED_AUTH_HEADER, redactCredentialAfterPrefix)
    .replaceAll(SERIALIZED_SENSITIVE_VALUE, redactCredentialAfterPrefix)
    .replaceAll(BARE_JWT, REDACTED)
