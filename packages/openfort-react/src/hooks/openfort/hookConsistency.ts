import type { OpenfortError, OpenfortHookOptions } from '../../types'

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

  if (hookOptions?.throwOnError || options?.throwOnError) throw error

  return { error }
}
