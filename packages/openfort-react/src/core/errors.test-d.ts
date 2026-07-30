import { assertType, expectTypeOf, test } from 'vitest'

import {
  AuthenticationError,
  MissingParameterError,
  OpenfortError,
  type OpenfortErrorType,
  OpenfortReactErrorType,
  WalletCreationError,
} from './errors.js'

test('constructor signature', () => {
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom')
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', { cause: new Error('cause') })
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', {
    details: 'details',
    docsPath: '/wallets',
    metaMessages: ['line'],
  })

  // @ts-expect-error - the second argument is an options bag, not a bare enum member.
  assertType(new OpenfortError('boom', OpenfortReactErrorType.WALLET_ERROR))
})

test('instance shape', () => {
  const error = new OpenfortError('boom')

  expectTypeOf(error).toExtend<Error>()
  expectTypeOf(error.type).toEqualTypeOf<OpenfortReactErrorType>()
  expectTypeOf(error.shortMessage).toEqualTypeOf<string>()
  expectTypeOf(error.details).toEqualTypeOf<string>()
  expectTypeOf(error.message).toEqualTypeOf<string>()
  expectTypeOf(error.walk()).toEqualTypeOf<unknown>()
})

test('name-based narrowing', () => {
  // The `XErrorType` companions pin `name`, so a union of them narrows on `error.name`.
  expectTypeOf<OpenfortErrorType['name']>().toEqualTypeOf<'OpenfortError'>()
})

test('subclass constructors', () => {
  expectTypeOf(AuthenticationError).toBeConstructibleWith('boom')
  expectTypeOf(MissingParameterError).toBeConstructibleWith({ params: ['email'] })
  expectTypeOf(WalletCreationError).toBeConstructibleWith({ chain: 'Solana', cause: new Error('cause') })

  // @ts-expect-error - `chain` is required and constrained to the supported families.
  assertType(new WalletCreationError({ chain: 'Bitcoin' }))
})

test('error type members', () => {
  expectTypeOf<`${OpenfortReactErrorType}`>().toEqualTypeOf<
    'AUTHENTICATION_ERROR' | 'WALLET_ERROR' | 'CONFIGURATION_ERROR' | 'VALIDATION_ERROR' | 'UNEXPECTED_ERROR'
  >()
})
