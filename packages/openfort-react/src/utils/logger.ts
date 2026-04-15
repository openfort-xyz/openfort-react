const PREFIX = '[Openfort-React]'

/**
 * SDK logger.
 *
 * `log` and `warn` are gated behind `enabled` to keep the console clean in
 * production. `error` always emits — silently swallowing errors in the
 * field makes real outages undebuggable and encourages blind `.catch(() => {})`
 * patterns that mask auth/recovery failures.
 */
export const logger = {
  enabled: false,
  // biome-ignore lint/suspicious/noConsole: allowed for debugging
  log: (...args: any[]) => (logger.enabled ? console.log(PREFIX, ...args) : null),
  // biome-ignore lint/suspicious/noConsole: errors always surface for diagnostics
  error: (...args: any[]) => console.error(PREFIX, ...args),
  // biome-ignore lint/suspicious/noConsole: allowed for debugging
  warn: (...args: any[]) => (logger.enabled ? console.warn(PREFIX, ...args) : null),
}
