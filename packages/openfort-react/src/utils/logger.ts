const PREFIX = '[Openfort-React]'

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
    // biome-ignore lint/suspicious/noConsole: verbose logging opted into through debugMode
    console.log(PREFIX, ...args)
  },
  // biome-ignore lint/suspicious/noConsole: errors must reach developers without debug mode
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
  // biome-ignore lint/suspicious/noConsole: warnings must reach developers without debug mode
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
}
