import type { OpenfortError, OpenfortHookOptions } from '../../types.js'

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
  hookOptions?.onSuccess?.(data)
  options?.onSuccess?.(data)

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
  hookOptions?.onError?.(error)
  options?.onError?.(error)

  return { error }
}
