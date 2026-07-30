import { assertType, expectTypeOf, test } from 'vitest'

import { OpenfortError, OpenfortReactErrorType } from './errors.js'

test('constructor signature', () => {
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', OpenfortReactErrorType.WALLET_ERROR)
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', OpenfortReactErrorType.WALLET_ERROR, {
    error: new Error('cause'),
  })

  // @ts-expect-error - the error type is a required enum member, not a string.
  assertType(new OpenfortError('boom', 'WALLET_ERROR'))
})

test('instance shape', () => {
  const error = new OpenfortError('boom', OpenfortReactErrorType.UNEXPECTED_ERROR)

  expectTypeOf(error).toExtend<Error>()
  expectTypeOf(error.type).toEqualTypeOf<OpenfortReactErrorType>()
  expectTypeOf(error.message).toEqualTypeOf<string>()
  // `data` is an open bag of diagnostic context, so values stay `unknown`.
  expectTypeOf(error.data).toEqualTypeOf<{ [key: string]: unknown }>()
  expectTypeOf(error.data.anything).toEqualTypeOf<unknown>()
})

test('error type members', () => {
  expectTypeOf<`${OpenfortReactErrorType}`>().toEqualTypeOf<
    'AUTHENTICATION_ERROR' | 'WALLET_ERROR' | 'CONFIGURATION_ERROR' | 'VALIDATION_ERROR' | 'UNEXPECTED_ERROR'
  >()
})
