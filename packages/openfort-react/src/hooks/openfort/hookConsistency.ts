import type { OpenfortError, OpenfortHookOptions } from '../../types.js'
import { logger } from '../../utils/logger.js'

/** Invokes a consumer callback without allowing its failure to alter the SDK operation. */
export function notifyHookCallback<T>(
  callback: ((value: T) => unknown) | undefined,
  value: T,
  callbackName: 'onSuccess' | 'onError'
): void {
  if (!callback) return
  try {
    void Promise.resolve(callback(value)).catch((error) => {
      logger.error(`[openfort-hook] ${callbackName} callback rejected`, error)
    })
  } catch (error) {
    logger.error(`[openfort-hook] ${callbackName} callback threw`, error)
  }
}

/** Runs the hook-level then the per-call success callback and passes the data through. */
export const onSuccess = <T>({
  hookOptions,
  options,
  data,
}: {
  hookOptions?: OpenfortHookOptions<T>
  options?: OpenfortHookOptions<T>
  data: T
}) => {
  notifyHookCallback(hookOptions?.onSuccess, data, 'onSuccess')
  notifyHookCallback(options?.onSuccess, data, 'onSuccess')

  return data
}

/**
 * Runs the hook-level then the per-call error callback and reports the failure
 * through the resolved value. Actions never reject, so every call site sees the
 * same `{ error }` shape whether or not callbacks were supplied.
 */
export const onError = <T>({
  hookOptions,
  options,
  error,
}: {
  hookOptions?: OpenfortHookOptions<T>
  options?: OpenfortHookOptions<T>
  error: OpenfortError
}) => {
  notifyHookCallback(hookOptions?.onError, error, 'onError')
  notifyHookCallback(options?.onError, error, 'onError')

  return { error }
}

/**
 * Shared default for hooks whose options parameter defaults to "no options".
 * One frozen instance, so the default keeps a stable identity across renders
 * and never becomes an accidental mutation channel.
 */
export const NO_HOOK_OPTIONS: Readonly<Record<never, never>> = Object.freeze({})
