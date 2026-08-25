import type { User, UserAccount } from '@openfort/openfort-js'
import { expectTypeOf, test } from 'vitest'

import { useUser } from './useUser.js'

test('return type', () => {
  const result = useUser()

  expectTypeOf(result.user).toEqualTypeOf<User | null>()
  expectTypeOf(result.linkedAccounts).toEqualTypeOf<UserAccount[]>()
  expectTypeOf(result.isLoading).toEqualTypeOf<boolean>()
  expectTypeOf(result.isAuthenticated).toEqualTypeOf<boolean>()
  expectTypeOf(result.isConnected).toEqualTypeOf<boolean>()
})

test('token helpers take no arguments', () => {
  const { getAccessToken, validateAndRefreshToken } = useUser()

  expectTypeOf(getAccessToken).toEqualTypeOf<() => Promise<string | null>>()
  expectTypeOf(validateAndRefreshToken).toEqualTypeOf<() => Promise<void>>()
})

test('takes no parameters', () => {
  expectTypeOf(useUser).parameters.toEqualTypeOf<[]>()
})
