import { assertType, expectTypeOf, test } from 'vitest'

import type { OpenfortError, OpenfortHookOptions } from '../../../types.js'
import { useSignOut } from './useSignOut.js'

test('parameters', () => {
  expectTypeOf(useSignOut).parameters.toEqualTypeOf<[OpenfortHookOptions?]>()

  // Hook-level callbacks are optional and receive the typed error.
  assertType(
    useSignOut({
      onSuccess: (data) => {
        expectTypeOf(data).toEqualTypeOf<{ error?: OpenfortError }>()
      },
      onError: (error) => {
        expectTypeOf(error).toEqualTypeOf<OpenfortError>()
      },
      throwOnError: true,
    })
  )
})

test('return type', () => {
  const { isLoading, isError, isSuccess, error, signOut } = useSignOut()

  expectTypeOf(isLoading).toEqualTypeOf<boolean>()
  expectTypeOf(isError).toEqualTypeOf<boolean>()
  expectTypeOf(isSuccess).toEqualTypeOf<boolean>()
  expectTypeOf(error).toEqualTypeOf<OpenfortError | null | undefined>()

  // `signOut` accepts per-call overrides of the same shape as the hook options.
  expectTypeOf(signOut).parameters.toEqualTypeOf<[OpenfortHookOptions?]>()
  // Failures are reported through the resolved value unless `throwOnError` is set.
  expectTypeOf(signOut).returns.resolves.toExtend<{ error?: OpenfortError }>()
})
