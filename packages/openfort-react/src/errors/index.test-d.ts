import { assertType, expectTypeOf, test } from 'vitest'

import { AuthenticationError, MissingParameterError, OpenfortError, WalletCreationError } from './index.js'

test('constructor signature', () => {
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom')
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', { cause: new Error('cause') })
  expectTypeOf(OpenfortError).toBeConstructibleWith('boom', {
    details: 'details',
    docsPath: '/wallets',
    metaMessages: ['line'],
  })

  // @ts-expect-error - the second argument is an options bag, not a bare string.
  assertType(new OpenfortError('boom', 'WALLET_ERROR'))
})

test('instance shape', () => {
  const error = new OpenfortError('boom')

  expectTypeOf(error).toExtend<Error>()
  expectTypeOf(error.shortMessage).toEqualTypeOf<string>()
  expectTypeOf(error.details).toEqualTypeOf<string>()
  expectTypeOf(error.message).toEqualTypeOf<string>()
  expectTypeOf(error.walk()).toEqualTypeOf<unknown>()
})

test('subclass constructors', () => {
  expectTypeOf(AuthenticationError).toBeConstructibleWith('boom')
  expectTypeOf(MissingParameterError).toBeConstructibleWith({ params: ['email'] })
  expectTypeOf(WalletCreationError).toBeConstructibleWith({ chain: 'Solana', cause: new Error('cause') })

  // @ts-expect-error - `chain` is required and constrained to the supported families.
  assertType(new WalletCreationError({ chain: 'Bitcoin' }))
})

test('subclass instances narrow to their base category', () => {
  const error: OpenfortError = new WalletCreationError({ chain: 'Solana' })

  if (error instanceof WalletCreationError) {
    expectTypeOf(error).toEqualTypeOf<WalletCreationError>()
    expectTypeOf(error.shortMessage).toEqualTypeOf<string>()
  }
})
